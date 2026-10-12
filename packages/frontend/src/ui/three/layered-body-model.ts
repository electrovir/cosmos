// cspell:words metalness fract
import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DataTexture,
    DataUtils,
    DoubleSide,
    Group,
    HalfFloatType,
    type Intersection,
    LinearFilter,
    type Material,
    Mesh,
    MeshStandardMaterial,
    Plane,
    type Ray,
    Raycaster,
    RepeatWrapping,
    RGFormat,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import {
    type BodyDetails,
    type BodySummary,
    LayerRegion,
    MatterState,
    type ValueRange,
} from '../../data/celestial-body.js';
import {CrustBoundary} from '../../data/earth/earth-data-files.js';
import {sampleGridValue} from '../../physics/equirectangular-grid.js';
import {directionToLatitudeLongitude, latitudeLongitudeToDirection} from '../../physics/frames.js';
import {
    findLayerAtRadius,
    getCutColumn,
    getLayerColumn,
    type LayerSegment,
} from '../../physics/layer-column.js';
import {type RadialScale, toDisplayRadius, toRealRadius} from '../../physics/radial-scale.js';
import {sampleSurface} from '../../physics/surface-data.js';
import {type BodyAssets} from './body-assets.js';
import {noiseShaderChunk} from './noise-shader-chunk.js';

/**
 * A full sphere, as a latitude and longitude grid so its vertices can follow the elevation data.
 * Normals come from slopes measured one row's angle apart in every direction. Normals from the
 * triangles go streaky near the poles, where each cell is far narrower than it is tall and small
 * steps between neighboring elevations turn into steep slopes.
 */
function createSphereGeometry({
    columns,
    rows,
    getRadius,
}: Readonly<{
    columns: number;
    rows: number;
    getRadius: (
        position: Readonly<{
            latitudeDegrees: number;
            longitudeDegrees: number;
        }>,
    ) => number;
}>) {
    const rowLength = columns + 1;
    const slopeStepRadians = Math.PI / rows;
    const positions = new Float32Array(rowLength * (rows + 1) * 3);
    const normals = new Float32Array(rowLength * (rows + 1) * 3);
    const uvs = new Float32Array(rowLength * (rows + 1) * 2);
    createArray(rows + 1, (row) => row).forEach((row) => {
        const latitudeDegrees = -90 + (180 * row) / rows;
        createArray(rowLength, (column) => column).forEach((column) => {
            const longitudeDegrees = -180 + (360 * column) / columns;
            const position = {
                latitudeDegrees,
                longitudeDegrees,
            };
            const direction = latitudeLongitudeToDirection(position);
            const radius = getRadius(position);
            const vertex = direction.clone().multiplyScalar(radius);
            const normal = getNormal({
                direction,
                radius,
            });
            const index = row * rowLength + column;
            positions.set(
                [
                    vertex.x,
                    vertex.y,
                    vertex.z,
                ],
                index * 3,
            );
            normals.set(
                [
                    normal.x,
                    normal.y,
                    normal.z,
                ],
                index * 3,
            );
            uvs.set(
                [
                    column / columns,
                    row / rows,
                ],
                index * 2,
            );
        });
    });
    const indices = createArray(rows, (row) => row).flatMap((row) => {
        return createArray(columns, (column) => column).flatMap((column) => {
            const bottomLeft = row * rowLength + column;
            const topLeft = bottomLeft + rowLength;
            return [
                bottomLeft,
                bottomLeft + 1,
                topLeft,
                topLeft,
                bottomLeft + 1,
                topLeft + 1,
            ];
        });
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;

    function getNormal({
        direction,
        radius,
    }: Readonly<{
        direction: Readonly<Vector3>;
        radius: number;
    }>) {
        const east = new Vector3(0, 1, 0).cross(direction);
        /** At a pole any tangent works, since the two together still cover every direction. */
        const firstTangent = (east.lengthSq() > 1e-12 ? east : new Vector3(1, 0, 0)).normalize();
        const secondTangent = direction.clone().cross(firstTangent);
        return [
            firstTangent,
            secondTangent,
        ]
            .reduce((normal, tangent) => {
                const [
                    ahead,
                    behind,
                ] = [
                    1,
                    -1,
                ].map((sign) => {
                    return getRadius(
                        directionToLatitudeLongitude(
                            direction.clone().addScaledVector(tangent, sign * slopeStepRadians),
                        ),
                    );
                });
                return normal.addScaledVector(
                    tangent,
                    -(assertWrap.isDefined(ahead) - assertWrap.isDefined(behind)) /
                        (2 * slopeStepRadians * radius),
                );
            }, direction.clone())
            .normalize();
    }
}

/**
 * The cut face's layer radii are sampled on this latitude and longitude grid. Rows include both
 * poles.
 */
const cutGrid = {
    columns: 720,
    rows: 361,
};
/**
 * Shared by the ground and the ocean so their triangles line up. A coarser ocean's flat triangles
 * dip below sea level between their corners, letting shallow seabed show through.
 */
const surfaceGrid = {
    columns: 512,
    rows: 256,
};
/**
 * Grid rows of real layer radii computed per frame. Filling the whole grid at once would freeze the
 * page, so the cut shows each layer's typical radii until the grid is full.
 */
const cutGridRowsPerFrame = 2;

const cutFaceVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    uniform float bodyScale;

    varying vec3 vBodyPosition;
    varying vec3 vCutPosition;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vBodyPosition = worldPosition.xyz / bodyScale;
        vCutPosition = position;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
        #include <logdepthbuf_vertex>
    }
`;

/**
 * Finds the layer under each pixel from the grid of layer radii, so the faces stay correct as the
 * body turns through the cut. Each layer is then textured by its state of matter: liquids flow,
 * plasma boils in cells, hot solids glow with slowly rising plumes, and cold rock sits still.
 *
 * The noise is sampled in the cut face's own frame rather than the body's, so the patterns don't
 * smear sideways when time is sped up and the body spins quickly through the cut.
 */
const cutFaceFragmentShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>

    uniform sampler2D layerRanges;
    uniform vec2 typicalRanges[LAYER_COUNT];
    uniform vec3 layerColors[LAYER_COUNT];
    uniform float layerStates[LAYER_COUNT];
    uniform float layerHeats[LAYER_COUNT];
    uniform float cutRadius;
    uniform float selectedLayerIndex;
    uniform float glow;
    uniform float time;

    varying vec3 vBodyPosition;
    varying vec3 vCutPosition;

    ${noiseShaderChunk}

    /** Dull red through orange and yellow to white, like heated metal. */
    vec3 incandescent(float heat) {
        return clamp(vec3(heat * 2.2, heat * 2.2 - 0.7, heat * 3.0 - 2.0), 0.0, 1.0);
    }

    /** Kept low in contrast so the churning reads as motion without pulling focus. */
    vec3 liquidColor(vec3 point, vec3 base, float heat) {
        vec3 scaled = point * 2.5;
        vec3 warp = vec3(
            fbm(scaled + vec3(0.0, 0.0, time * 0.1)),
            fbm(scaled + vec3(5.2, 1.3, -time * 0.08)),
            fbm(scaled + vec3(9.1, 4.7, time * 0.06))
        );
        float flow = fbm(scaled + 2.0 * warp + vec3(time * 0.04));
        float veins = pow(1.0 - abs(flow), 6.0);
        vec3 color = base * (0.85 + 0.2 * smoothstep(-0.4, 0.5, flow));
        return color + incandescent(0.6 + 0.4 * heat) * veins * 0.2;
    }

    /** Thin, cool plasma shimmers. Hot, dense plasma boils in bright cells with dark lanes. */
    vec3 plasmaColor(vec3 point, vec3 base, float heat) {
        vec3 boil = vec3(fbm(point * 4.0 + vec3(time * 0.3)), fbm(point * 4.0 - vec3(time * 0.25)), 0.0);
        float shimmer = fbm(point * 3.0 + boil + vec3(0.0, 0.0, time * 0.2));
        vec3 cool = base * (0.75 + 0.35 * shimmer);
        if (heat <= 0.0) {
            return cool;
        }
        vec2 granules = cells(point * 10.0 + boil * 1.5, time * 0.8);
        float bright = (1.0 - smoothstep(0.0, 0.7, granules.x)) * smoothstep(0.0, 0.12, granules.y - granules.x);
        float flicker = 0.9 + 0.1 * simplexNoise(point * 30.0 + vec3(0.0, 0.0, time * 3.0));
        vec3 hot = base * (0.5 + 0.7 * bright) * flicker + vec3(0.25, 0.2, 0.1) * bright;
        return mix(cool, hot, heat);
    }

    /**
     * Hot rock creeps upward in plumes, so the noise is stretched along the radius and drifts
     * outward over time.
     */
    vec3 solidColor(vec3 point, vec3 base, float heat) {
        float radius = length(point);
        vec3 outward = point / max(radius, 1e-4);
        float mottle = fbm(point * 9.0 + vec3(0.0, 0.0, time * 0.02));
        float grain = simplexNoise(point * 40.0);
        vec3 color = base * (0.8 + 0.2 * mottle + 0.06 * grain);
        float plume = smoothstep(0.1, 0.6, fbm(outward * 5.0 + vec3(radius * 4.0 - time * 0.06)));
        vec2 crystals = cells(point * 12.0 + mottle * 0.3, time * 0.05);
        float cracks = 1.0 - smoothstep(0.0, 0.06, crystals.y - crystals.x);
        float breathing = 0.75 + 0.25 * sin(time * 0.9 + mottle * 8.0);
        vec3 hot = incandescent(heat);
        color = mix(color, hot, min(heat * plume * breathing * 1.2, 1.0));
        return color + hot * cracks * heat * breathing;
    }

    vec3 gasColor(vec3 point, vec3 base) {
        return base * (0.85 + 0.15 * fbm(point * 4.0 + vec3(time * 0.05, 0.0, 0.0)));
    }

    void main() {
        #include <logdepthbuf_fragment>
        float radius = length(vBodyPosition);
        float latitude = asin(clamp(vBodyPosition.y / radius, -1.0, 1.0));
        float longitude = atan(-vBodyPosition.z, vBodyPosition.x);
        float u = longitude / (2.0 * PI) + 0.5 + 0.5 / GRID_COLUMNS;
        float row = (latitude / PI + 0.5) * (GRID_ROWS - 1.0);
        float layerIndex = -1.0;
        float progress = 0.0;
        vec3 layerColor = vec3(0.0);
        float layerState = 0.0;
        float layerHeat = 0.0;
        for (int index = 0; index < LAYER_COUNT; index++) {
            vec2 range = typicalRanges[index] + texture2D(
                layerRanges,
                vec2(u, (float(index) * GRID_ROWS + row + 0.5) / (GRID_ROWS * float(LAYER_COUNT)))
            ).rg;
            if (layerIndex < 0.0 && radius >= range.x && radius < range.y) {
                layerIndex = float(index);
                progress = (radius - range.x) / (range.y - range.x);
                layerColor = layerColors[index];
                layerState = layerStates[index];
                layerHeat = layerHeats[index];
            }
        }
        float edgeDistance = min(progress, 1.0 - progress);
        float edgeLine = 1.0 - smoothstep(0.0, fwidth(progress) * 1.5, edgeDistance);
        if (layerIndex < 0.0) {
            discard;
        }
        vec3 base = layerColor * (0.8 + 0.2 * progress);
        vec3 point = vCutPosition / cutRadius;
        vec3 color = layerState == STATE_LIQUID
            ? liquidColor(point, base, layerHeat)
            : layerState == STATE_PLASMA
            ? plasmaColor(point, base, layerHeat)
            : layerState == STATE_GAS
            ? gasColor(point, base)
            : solidColor(point, base, layerHeat);
        color = mix(color, vec3(0.0), edgeLine * 0.6 * (1.0 - layerHeat * 0.7));
        float axisDistance = length(vCutPosition.xz);
        float axisLine = 1.0 - smoothstep(0.0, fwidth(axisDistance) * 3.0, axisDistance);
        color = mix(color, vec3(0.0), axisLine * 0.4);
        float isSelected = 1.0 - step(0.5, abs(layerIndex - selectedLayerIndex));
        float isDimmed = step(0.0, selectedLayerIndex) * (1.0 - isSelected);
        color = mix(color, vec3(1.0), isSelected * glow);
        color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), isDimmed * 0.6) * mix(1.0, 0.3, isDimmed);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;

export const atmosphereGlowVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewDirection;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <clipping_planes_vertex>
    }
`;

export const atmosphereGlowFragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    uniform vec3 towardSun;

    varying vec3 vNormal;
    varying vec3 vViewDirection;

    void main() {
        #include <clipping_planes_fragment>
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 3.0);
        float daylight = clamp(dot(normalize(vNormal), towardSun) + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * rim * (0.15 + 0.85 * daylight), 1.0);
    }
`;

const matterStateShaderCodes: Record<MatterState, number> = {
    [MatterState.Solid]: 0,
    [MatterState.Liquid]: 1,
    [MatterState.Gas]: 2,
    [MatterState.Plasma]: 3,
};

/**
 * How brightly a layer glows or boils in the cut, from 0 to 1. Rock starts glowing dull red around
 * the Draper point and is white hot by the temperature of Earth's inner core. Plasma spans
 * thousands to millions of kelvin, so its heat follows the temperature's order of magnitude.
 */
const getLayerHeat: Record<MatterState, (averageKelvin: number) => number> = {
    [MatterState.Solid]: getCondensedHeat,
    [MatterState.Liquid]: getCondensedHeat,
    [MatterState.Gas]() {
        return 0;
    },
    [MatterState.Plasma](averageKelvin) {
        return clampHeat(Math.log10(averageKelvin / 5000) / 3.3);
    },
};

function getCondensedHeat(averageKelvin: number) {
    return clampHeat((averageKelvin - 800) / 5200);
}

function clampHeat(heat: number) {
    return Math.min(Math.max(heat, 0), 1);
}

/** Half the angle between the cut's two faces. */
const cutHalfAngleRadians = Math.PI / 4;

/**
 * The cut's two faces, as half-planes from the pole-to-pole axis out to `radius`, opening around
 * +x. The mesh turns them to face the Sun.
 */
function createCutFaceGeometry(radius: number) {
    const positions = [
        -cutHalfAngleRadians,
        cutHalfAngleRadians,
    ].flatMap((angle) => {
        const outward = new Vector3(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
        const corners = [
            new Vector3(0, -radius, 0),
            outward.clone().setY(-radius),
            new Vector3(0, radius, 0),
            outward.clone().setY(radius),
        ];
        return [
            0,
            1,
            2,
            2,
            1,
            3,
        ].flatMap((cornerIndex) => {
            const corner = assertWrap.isDefined(corners[cornerIndex]);
            return [
                corner.x,
                corner.y,
                corner.z,
            ];
        });
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.computeBoundingSphere();
    return geometry;
}

/**
 * A body drawn as nested layers with a wedge cut out, so the inside shows: a surface (raised and
 * lowered by the elevation data when there is some), flat faces across the cut colored by layer, an
 * optional ocean, and a glow for the atmosphere.
 */
export function createLayeredBodyModel({
    summary,
    details,
    assets,
    radialScale,
    customSurfaceMaterial,
}: Readonly<{
    summary: Readonly<BodySummary>;
    details: Readonly<BodyDetails>;
    assets: Readonly<BodyAssets>;
    radialScale: RadialScale;
    /**
     * Replaces the lit surface. It isn't clipped by the cut unless given `cutPlanes` afterward, and
     * it is disposed with the model.
     */
    customSurfaceMaterial?: Material | undefined;
}>) {
    const group = new Group();
    /**
     * Holds the body's own meshes, apart from whatever else is added to `group`, so it can grow
     * alone.
     */
    const bodyGroup = new Group();
    group.add(bodyGroup);
    const surfaceRadiusKm = summary.radiusKm;

    function toDisplay(realKm: number) {
        return toDisplayRadius({
            scale: radialScale,
            realKm,
        });
    }

    function getColumn(
        position: Readonly<{
            latitudeDegrees: number;
            longitudeDegrees: number;
        }>,
    ) {
        return getLayerColumn({
            details,
            surfaceRadiusKm,
            surface: assets.surfaceData
                ? sampleSurface({
                      data: assets.surfaceData,
                      ...position,
                  })
                : undefined,
        });
    }

    const oceanLayerId = details.crust?.layerIdsByBoundary[CrustBoundary.WaterBottom];

    /**
     * The cut is a wedge, pole to pole, that faces the Sun. The surface materials drop whatever is
     * behind both of these planes.
     */
    const cutPlanes = [
        new Plane(),
        new Plane(),
    ];

    const surfaceMaterial =
        customSurfaceMaterial ??
        new MeshStandardMaterial({
            map: assets.surfaceColor ?? null,
            color: assets.surfaceColor
                ? 0xff_ff_ff
                : (details.layers.findLast((layer) => layer.region !== LayerRegion.Atmosphere)
                      ?.color ?? 0xff_ff_ff),
            roughness: 1,
            metalness: 0,
            clippingPlanes: cutPlanes,
            clipIntersection: true,
        });
    const surface = new Mesh(
        createSphereGeometry({
            ...surfaceGrid,
            getRadius(position) {
                return toDisplay(
                    surfaceRadiusKm +
                        (assets.surfaceData
                            ? sampleGridValue({
                                  grid: assets.surfaceData.elevation,
                                  ...position,
                              }) / 1000
                            : 0),
                );
            },
        }),
        surfaceMaterial,
    );
    bodyGroup.add(surface);

    const oceanMaterial = new MeshStandardMaterial({
        color: 0x0b_3d_6e,
        transparent: true,
        opacity: 0.55,
        roughness: 0.3,
        metalness: 0,
        depthWrite: false,
        clippingPlanes: cutPlanes,
        clipIntersection: true,
    });
    const ocean = oceanLayerId
        ? new Mesh(
              createSphereGeometry({
                  ...surfaceGrid,
                  getRadius() {
                      return toDisplay(surfaceRadiusKm);
                  },
              }),
              oceanMaterial,
          )
        : undefined;
    if (ocean) {
        ocean.renderOrder = 1;
        bodyGroup.add(ocean);
    }

    const atmosphereGlowUniforms = {
        towardSun: {
            value: new Vector3(1, 0, 0),
        },
    };
    const atmosphereGlowMaterial = new ShaderMaterial({
        vertexShader: atmosphereGlowVertexShader,
        fragmentShader: atmosphereGlowFragmentShader,
        uniforms: atmosphereGlowUniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        clipping: true,
        clippingPlanes: cutPlanes,
        clipIntersection: true,
    });
    const atmosphereGlow = new Mesh(
        createSphereGeometry({
            columns: 128,
            rows: 64,
            getRadius() {
                return toDisplay(surfaceRadiusKm + 100);
            },
        }),
        atmosphereGlowMaterial,
    );
    atmosphereGlow.renderOrder = 2;
    /** The glow is daylight scattered by air, which a plasma atmosphere doesn't do. */
    atmosphereGlow.visible = details.layers.some(
        (layer) => layer.region === LayerRegion.Atmosphere && layer.state === MatterState.Gas,
    );
    bodyGroup.add(atmosphereGlow);

    /** The exosphere is far too thin to show in the cut, and would dwarf everything else. */
    const cutLayers = details.layers.filter((layer) => {
        return layer.radiusKm.max <= surfaceRadiusKm * 2 && !layer.isHiddenInCut;
    });

    /**
     * Every cut layer's display radii in one column. A layer missing from the column gets a
     * zero-thickness range where it would be, which draws nothing.
     */
    function getCutRanges(column: ReadonlyArray<Readonly<LayerSegment>>) {
        return cutLayers.reduce<{
            ranges: ValueRange[];
            topKm: number;
        }>(
            (accumulator, layer) => {
                const range = column.find((segment) => segment.layer.id === layer.id)?.radiusKm ?? {
                    min: accumulator.topKm,
                    max: accumulator.topKm,
                };
                return {
                    ranges: [
                        ...accumulator.ranges,
                        {
                            min: toDisplay(range.min),
                            max: toDisplay(range.max),
                        },
                    ],
                    topKm: range.max,
                };
            },
            {
                ranges: [],
                topKm: 0,
            },
        ).ranges;
    }

    /**
     * The grid holds each spot's offset from these, which keeps the values small enough for half
     * floats.
     */
    const typicalRanges = getCutRanges(
        getCutColumn(
            getLayerColumn({
                details,
                surfaceRadiusKm,
            }),
        ),
    ).map((range) => new Vector2(range.min, range.max));
    const cutGridData = new Uint16Array(cutGrid.columns * cutGrid.rows * cutLayers.length * 2);
    const cutGridTexture = new DataTexture(
        cutGridData,
        cutGrid.columns,
        cutGrid.rows * cutLayers.length,
        RGFormat,
        HalfFloatType,
    );
    cutGridTexture.minFilter = LinearFilter;
    cutGridTexture.magFilter = LinearFilter;
    cutGridTexture.wrapS = RepeatWrapping;
    cutGridTexture.needsUpdate = true;
    const cutGridFill = {
        nextRow: assets.surfaceData ? 0 : cutGrid.rows,
    };

    function fillCutGridRow(row: number) {
        const latitudeDegrees = -90 + (180 * row) / (cutGrid.rows - 1);
        createArray(cutGrid.columns, (column) => column).forEach((column) => {
            getCutRanges(
                getCutColumn(
                    getColumn({
                        latitudeDegrees,
                        longitudeDegrees: -180 + (360 * column) / cutGrid.columns,
                    }),
                ),
            ).forEach((range, layerIndex) => {
                const typical = assertWrap.isDefined(typicalRanges[layerIndex]);
                cutGridData.set(
                    [
                        DataUtils.toHalfFloat(range.min - typical.x),
                        DataUtils.toHalfFloat(range.max - typical.y),
                    ],
                    ((layerIndex * cutGrid.rows + row) * cutGrid.columns + column) * 2,
                );
            });
        });
    }

    const cutRadius = Math.max(...typicalRanges.map((range) => range.y));
    const cutFaceUniforms = {
        layerRanges: {
            value: cutGridTexture,
        },
        typicalRanges: {
            value: typicalRanges,
        },
        layerColors: {
            value: cutLayers.map((layer) => new Color(layer.color)),
        },
        layerStates: {
            value: cutLayers.map((layer) => matterStateShaderCodes[layer.state]),
        },
        layerHeats: {
            value: cutLayers.map((layer) => {
                return layer.temperatureKelvin
                    ? getLayerHeat[layer.state](
                          (layer.temperatureKelvin.min + layer.temperatureKelvin.max) / 2,
                      )
                    : 0;
            }),
        },
        cutRadius: {
            value: cutRadius,
        },
        bodyScale: {
            value: 1,
        },
        time: {
            value: 0,
        },
        selectedLayerIndex: {
            value: -1,
        },
        glow: {
            value: 0,
        },
    };
    const cutFaceMaterial = new ShaderMaterial({
        vertexShader: cutFaceVertexShader,
        fragmentShader: cutFaceFragmentShader,
        uniforms: cutFaceUniforms,
        defines: {
            LAYER_COUNT: cutLayers.length,
            GRID_COLUMNS: cutGrid.columns.toFixed(1),
            GRID_ROWS: cutGrid.rows.toFixed(1),
            STATE_LIQUID: matterStateShaderCodes[MatterState.Liquid].toFixed(1),
            STATE_GAS: matterStateShaderCodes[MatterState.Gas].toFixed(1),
            STATE_PLASMA: matterStateShaderCodes[MatterState.Plasma].toFixed(1),
        },
        side: DoubleSide,
    });
    const cutFaceMesh = new Mesh(createCutFaceGeometry(cutRadius * 1.05), cutFaceMaterial);
    bodyGroup.add(cutFaceMesh);

    const raycaster = new Raycaster();

    function isInCut(point: Readonly<Vector3>) {
        return cutPlanes.every((plane) => plane.distanceToPoint(point) < 0);
    }

    function pickHit(hit: Readonly<Intersection>) {
        if (hit.object !== cutFaceMesh && isInCut(hit.point)) {
            return undefined;
        }
        const position = directionToLatitudeLongitude(hit.point);
        const column = getColumn(position);
        const realRadiusKm = toRealRadius({
            scale: radialScale,
            displayKm: hit.point.length() / bodyGroup.scale.x,
        });
        const cutSegment =
            hit.object === cutFaceMesh
                ? findLayerAtRadius({
                      column: getCutColumn(column),
                      radiusKm: realRadiusKm,
                  })
                : undefined;
        /**
         * The surface mesh only approximates the data between its vertices, so a surface hit takes
         * the column's top layer that the cut shows rather than whatever its exact radius lands
         * in.
         */
        const layer =
            hit.object === cutFaceMesh
                ? cutSegment && realRadiusKm >= cutSegment.radiusKm.min
                    ? cutSegment.layer
                    : undefined
                : column.findLast((segment) => {
                      return (
                          segment.layer.region !== LayerRegion.Atmosphere &&
                          !segment.layer.isHiddenInCut
                      );
                  })?.layer;
        return layer
            ? {
                  layer,
                  point: {
                      ...position,
                      /** Negative below the surface radius. */
                      altitudeKm: realRadiusKm - surfaceRadiusKm,
                  },
              }
            : undefined;
    }

    return {
        group,
        /** The cut's planes, to clip other surface-hugging materials the same way. */
        cutPlanes,
        /** Finds the layer that a ray in the body's frame hits first. */
        pick(ray: Readonly<Ray>) {
            raycaster.ray.copy(ray);
            return raycaster
                .intersectObjects(
                    [
                        ...(cutFaceMesh.visible ? [cutFaceMesh] : []),
                        surface,
                        ...(ocean ? [ocean] : []),
                    ],
                    false,
                )
                .reduce<ReturnType<typeof pickHit>>(
                    (found, hit) => found ?? pickHit(hit),
                    undefined,
                );
        },
        setSelectedLayer(layerId: string | undefined) {
            const cutLayerIndex = cutLayers.findIndex((layer) => layer.id === layerId);
            /** A selected layer outside the cut still dims every layer in it. */
            cutFaceUniforms.selectedLayerIndex.value =
                layerId == undefined ? -1 : cutLayerIndex === -1 ? cutLayers.length : cutLayerIndex;
        },
        update({
            towardSun,
            glow,
            animationSeconds,
            isCutOpen,
            scale,
        }: Readonly<{
            /** In the body's frame. */
            towardSun: Readonly<Vector3>;
            /** How strongly the selected layer lights up, from 0 to 1. */
            glow: number;
            /**
             * Wall-clock seconds that drive the cut's churning, so speeding up time doesn't blur
             * it.
             */
            animationSeconds: number;
            /** When false, the body draws whole. */
            isCutOpen: boolean;
            /** How many times larger than true size to draw the body, without its field or orbits. */
            scale: number;
        }>) {
            bodyGroup.scale.setScalar(scale);
            cutFaceUniforms.bodyScale.value = scale;
            cutFaceMesh.visible = isCutOpen;
            atmosphereGlowUniforms.towardSun.value.copy(towardSun);
            cutFaceUniforms.glow.value = glow;
            cutFaceUniforms.time.value = animationSeconds;

            /** The cut opens toward the Sun's longitude, so the body turns through it. */
            const sunLongitudeRadians = Math.atan2(-towardSun.z, towardSun.x);
            cutFaceMesh.rotation.y = sunLongitudeRadians;
            cutPlanes.forEach((plane, index) => {
                plane.normal
                    .set(1, 0, 0)
                    .applyAxisAngle(
                        new Vector3(0, 1, 0),
                        sunLongitudeRadians + (index ? 1 : -1) * cutHalfAngleRadians,
                    )
                    .negate();
                /** Pushing a plane past the whole body clips nothing, which closes the wedge. */
                plane.constant = isCutOpen ? 0 : cutRadius * scale * 2;
            });

            if (cutGridFill.nextRow < cutGrid.rows) {
                createArray(
                    Math.min(cutGridRowsPerFrame, cutGrid.rows - cutGridFill.nextRow),
                    (index) => cutGridFill.nextRow + index,
                ).forEach(fillCutGridRow);
                cutGridFill.nextRow += cutGridRowsPerFrame;
                if (cutGridFill.nextRow >= cutGrid.rows) {
                    cutGridTexture.needsUpdate = true;
                }
            }
        },
        dispose() {
            [
                surface,
                atmosphereGlow,
                cutFaceMesh,
                ...(ocean ? [ocean] : []),
            ].forEach((mesh) => {
                mesh.geometry.dispose();
            });
            [
                surfaceMaterial,
                oceanMaterial,
                atmosphereGlowMaterial,
                cutFaceMaterial,
            ].forEach((material) => {
                material.dispose();
            });
            cutGridTexture.dispose();
        },
    };
}

export type LayeredBodyModel = ReturnType<typeof createLayeredBodyModel>;
