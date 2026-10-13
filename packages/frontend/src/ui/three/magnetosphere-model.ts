// cspell:words dawnward fract lerp
import {assertWrap} from '@augment-vir/assert';
import {createArray, randomInteger} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Group,
    InstancedInterleavedBuffer,
    InterleavedBufferAttribute,
    LatheGeometry,
    MathUtils,
    Matrix4,
    Mesh,
    type Plane,
    Points,
    Quaternion,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {type MagneticDipole} from '../../data/celestial-body.js';
import {latitudeLongitudeToDirection} from '../../physics/frames.js';
import {
    type BoundaryShape,
    createMagnetosphere,
    type FieldLine,
    type FieldLineSeed,
    getBoundaryCylinderRadii,
    getBoundaryRadius,
    getFieldLineSeeds,
    type Magnetosphere,
    traceSeededFieldLine,
} from '../../physics/magnetosphere.js';
import {type RadialScale, toDisplayRadius} from '../../physics/radial-scale.js';
import {createRandom, type SolarWindConditions} from '../../physics/solar-wind-weather.js';
import {defaultFieldOpacity} from '../field-opacity.js';
import {RenderEffect} from './render-quality.js';
import {createWindEntryParticles} from './wind-entry-particles.js';

/**
 * Tracing every line at once takes long enough to drop a frame, so each frame traces only this
 * many, and the finished set replaces the drawn lines all at once.
 */
const linesTracedPerFrame = 16;

/** Solar wind particles flow from here, in planet radii toward the Sun, to `windEndX`. */
const windStartX = 40;
const windEndX = -60;
const windParticleCount = 6000;
/** Samples of the boundaries' widths along the wind's path, for the wind shader. */
const windRadiusSampleCount = 64;
/** Wind particles start up to this far from the planet-Sun line, in planet radii. */
const windMaxStartRadius = 25;

const auroraSegments = 160;
/** How many recent particle landings the aurora can brighten for at once. */
const auroraLandingCount = 16;
/** How long a landing keeps the aurora brightened, in seconds. */
const auroraLandingSeconds = 1.5;

const fieldLineColors = {
    closed: new Color('#4da3ff'),
    open: new Color('#b07cff'),
};

const glowShellVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewDirection;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
        #include <logdepthbuf_vertex>
    }
`;

const glowShellFragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>

    uniform vec3 color;
    uniform float intensity;

    varying vec3 vNormal;
    varying vec3 vViewDirection;

    void main() {
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 2.0);
        gl_FragColor = vec4(color * rim * intensity, 1.0);
    }
`;

const windVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    /** How far the wind has flowed so far, in planet radii. */
    uniform float traveled;
    uniform float magnetopauseRadii[${windRadiusSampleCount}];
    uniform float shockRadii[${windRadiusSampleCount}];
    uniform float planetRadius;
    uniform float visibleFraction;
    uniform float pointSize;

    /** x: where along the path it starts, y: distance from the axis, z: angle around the axis. */
    attribute vec3 seed;
    attribute float visibilityRank;

    varying float vSheath;
    varying float vAlpha;

    void main() {
        float travel = ${windStartX.toFixed(1)} - ${windEndX.toFixed(1)};
        float progress = mod(seed.x + traveled / travel, 1.0);
        float x = ${windStartX.toFixed(1)} - progress * travel;
        float sampleIndex = progress * ${(windRadiusSampleCount - 1).toFixed(1)};
        int lowerIndex = int(floor(sampleIndex));
        int upperIndex = min(lowerIndex + 1, ${windRadiusSampleCount - 1});
        float blend = fract(sampleIndex);
        float magnetopauseRadius = mix(magnetopauseRadii[lowerIndex], magnetopauseRadii[upperIndex], blend);
        float shockRadius = mix(shockRadii[lowerIndex], shockRadii[upperIndex], blend);
        /** Streamlines part around the magnetopause as if it were a solid obstacle. */
        float radius = sqrt(seed.y * seed.y + magnetopauseRadius * magnetopauseRadius);
        vSheath = 1.0 - smoothstep(shockRadius - 1.0, shockRadius + 1.0, radius);
        vAlpha = smoothstep(0.0, 0.08, progress) * smoothstep(1.0, 0.85, progress)
            * step(visibilityRank, visibleFraction);
        vec3 local = vec3(x, radius * cos(seed.z), radius * sin(seed.z));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(local * planetRadius, 1.0);
        gl_PointSize = pointSize;
        #include <logdepthbuf_vertex>
    }
`;

const windFragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>

    uniform float brightness;

    varying float vSheath;
    varying float vAlpha;

    void main() {
        #include <logdepthbuf_fragment>
        float distanceFromCenter = length(gl_PointCoord - 0.5);
        if (distanceFromCenter > 0.5 || vAlpha <= 0.0) {
            discard;
        }
        vec3 color = mix(vec3(1.0, 0.92, 0.7), vec3(1.0, 0.55, 0.25), vSheath);
        gl_FragColor = vec4(
            color * vAlpha * (1.0 - distanceFromCenter * 2.0) * 0.8 * brightness,
            1.0
        );
    }
`;

const auroraVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    /** Angle around the magnetic pole from local midnight. */
    attribute float ringAngle;
    attribute float height;

    varying float vRingAngle;
    varying float vHeight;
    varying vec3 vDirection;

    void main() {
        vRingAngle = ringAngle;
        vHeight = height;
        vDirection = normalize(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <clipping_planes_vertex>
    }
`;

const auroraFragmentShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    uniform float time;
    uniform float activity;
    uniform vec3 towardSun;
    uniform vec3 magneticNorth;
    /** x: angle around the pole from midnight, y: hemisphere (1 north, -1 south), z: strength. */
    uniform vec3 landings[${auroraLandingCount}];

    varying float vRingAngle;
    varying float vHeight;
    varying vec3 vDirection;

    void main() {
        #include <logdepthbuf_fragment>
        #include <clipping_planes_fragment>
        /** Oxygen glows green low down and red higher up, where the air is thinner. */
        vec3 color = mix(vec3(0.2, 1.0, 0.45), vec3(1.0, 0.25, 0.4), smoothstep(0.35, 1.0, vHeight));
        float curtain = smoothstep(0.0, 0.12, vHeight) * pow(1.0 - vHeight, 1.2);
        float flicker = 0.55 + 0.45 * sin(vRingAngle * 23.0 + time * 1.7) * sin(vRingAngle * 7.0 - time * 0.9);
        float night = 0.3 + 0.7 * smoothstep(0.2, -0.3, dot(vDirection, towardSun));
        float midnight = 0.6 + 0.4 * cos(vRingAngle);
        float hemisphere = sign(dot(vDirection, magneticNorth));
        float landingGlow = 0.0;
        for (int index = 0; index < ${auroraLandingCount}; index++) {
            vec3 landing = landings[index];
            float angleOffset = abs(mod(vRingAngle - landing.x + PI, 2.0 * PI) - PI);
            landingGlow += landing.z * step(0.0, hemisphere * landing.y)
                * exp(-angleOffset * angleOffset / 0.02);
        }
        gl_FragColor = vec4(
            color * curtain * (flicker * night * midnight * (0.25 + activity) * 3.0 + landingGlow * 2.5),
            1.0
        );
    }
`;

const shellIntensities = {
    magnetopause: 0.22,
    bowShock: 0.1,
};

function createGlowShellMaterial({color, intensity}: Readonly<{color: string; intensity: number}>) {
    return new ShaderMaterial({
        vertexShader: glowShellVertexShader,
        fragmentShader: glowShellFragmentShader,
        uniforms: {
            color: {
                value: new Color(color),
            },
            intensity: {
                value: intensity,
            },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
    });
}

/**
 * Drops points where a line runs nearly straight. Tracing takes tiny steps near the planet, far
 * more points than drawing the line needs.
 */
function simplifyLine(points: ReadonlyArray<Readonly<Vector3>>) {
    const minTurnCosine = Math.cos(MathUtils.degToRad(1.5));
    return points.reduce<Vector3[]>((kept, point, index) => {
        const lastKept = kept.at(-1);
        const next = points[index + 1];
        const isTurning =
            !lastKept ||
            !next ||
            point.clone().sub(lastKept).normalize().dot(next.clone().sub(lastKept).normalize()) <
                minTurnCosine;
        return isTurning
            ? [
                  ...kept,
                  point.clone(),
              ]
            : kept;
    }, []);
}

/** A boundary's surface of revolution around the x axis, which points toward the Sun. */
function createBoundaryGeometry(shape: Readonly<BoundaryShape>) {
    const profile = createArray(64, (index) => {
        const angle = (index / 63) * Math.PI * 0.85;
        const radius = getBoundaryRadius({
            shape,
            angleFromSunRadians: angle,
        });
        return new Vector2(radius * Math.sin(angle), radius * Math.cos(angle));
    }).filter((point) => point.y > windEndX);
    return new LatheGeometry(profile, 64).rotateZ(-Math.PI / 2);
}

/**
 * A planet's magnetic field and the solar wind around it, in the planet's frame and in kilometers:
 * traced field lines, the magnetopause and bow shock, wind particles flowing around them, some of
 * them getting in through the polar cusps and the tail, and aurora rings.
 */
export function createMagnetosphereModel({
    surfaceRadiusKm,
    magneticDipole,
    radialScale,
    cutPlanes,
}: Readonly<{
    surfaceRadiusKm: number;
    magneticDipole: Readonly<MagneticDipole>;
    radialScale: RadialScale;
    /** The planet's cut, which hides the aurora along with the surface. */
    cutPlanes: Plane[];
}>) {
    const random = createRandom(
        randomInteger({
            min: 0,
            max: 2 ** 32 - 1,
        }),
    );
    const group = new Group();
    const fieldGroup = new Group();
    group.add(fieldGroup);
    /**
     * Holds everything laid out in the magnetosphere frame (x toward the Sun). Turning this group
     * every frame keeps the field following the Sun and the planet's spin smoothly between traces.
     */
    const magnetosphereGroup = new Group();
    fieldGroup.add(magnetosphereGroup);
    /**
     * The solar wind's frame: x toward the Sun like the magnetosphere's, but kept level with the
     * planet's north instead of the magnetic pole. The magnetosphere frame rolls around x once per
     * day as the tilted pole spins, which would swirl the wind when time is sped up.
     */
    const windGroup = new Group();
    fieldGroup.add(windGroup);
    const magneticNorth = latitudeLongitudeToDirection(magneticDipole.northPole);

    /** Planet radii to drawn kilometers, stretched like the planet's layers. */
    function toDisplayPoint(point: Readonly<Vector3>) {
        const distance = point.length();
        return distance
            ? point.clone().multiplyScalar(
                  toDisplayRadius({
                      scale: radialScale,
                      realKm: distance * surfaceRadiusKm,
                  }) / distance,
              )
            : new Vector3();
    }

    const fieldLineMaterial = new LineMaterial({
        vertexColors: true,
        linewidth: 1.5,
        dashed: true,
        dashSize: surfaceRadiusKm * 0.4,
        gapSize: surfaceRadiusKm * 0.3,
        transparent: true,
        opacity: defaultFieldOpacity,
        depthWrite: false,
    });
    const fieldLines = new LineSegments2(new LineSegmentsGeometry(), fieldLineMaterial);
    magnetosphereGroup.add(fieldLines);

    const magnetopauseMaterial = createGlowShellMaterial({
        color: '#6a8cff',
        intensity: shellIntensities.magnetopause,
    });
    const bowShockMaterial = createGlowShellMaterial({
        color: '#ffb36b',
        intensity: shellIntensities.bowShock,
    });
    const magnetopause = new Mesh(new BufferGeometry(), magnetopauseMaterial);
    const bowShock = new Mesh(new BufferGeometry(), bowShockMaterial);
    [
        magnetopause,
        bowShock,
    ].forEach((shell) => {
        shell.scale.setScalar(surfaceRadiusKm);
        shell.renderOrder = 3;
        magnetosphereGroup.add(shell);
    });

    const windUniforms = {
        traveled: {
            value: 0,
        },
        magnetopauseRadii: {
            value: new Array<number>(windRadiusSampleCount).fill(0),
        },
        shockRadii: {
            value: new Array<number>(windRadiusSampleCount).fill(0),
        },
        planetRadius: {
            value: surfaceRadiusKm,
        },
        visibleFraction: {
            value: 0.3,
        },
        pointSize: {
            value: 2,
        },
        brightness: {
            value: 1,
        },
    };
    const windGeometry = new BufferGeometry();
    windGeometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(windParticleCount * 3), 3),
    );
    windGeometry.setAttribute(
        'seed',
        new BufferAttribute(
            new Float32Array(
                createArray(windParticleCount, () => {
                    return [
                        random(),
                        /** Spread evenly over the starting disk's area. */
                        Math.sqrt(random()) * windMaxStartRadius,
                        random() * Math.PI * 2,
                    ];
                }).flat(),
            ),
            3,
        ),
    );
    windGeometry.setAttribute(
        'visibilityRank',
        new BufferAttribute(new Float32Array(createArray(windParticleCount, () => random())), 1),
    );
    const windMaterial = new ShaderMaterial({
        vertexShader: windVertexShader,
        fragmentShader: windFragmentShader,
        uniforms: windUniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    });
    const wind = new Points(windGeometry, windMaterial);
    /** The shader moves every particle, so the geometry's own bounds mean nothing. */
    wind.frustumCulled = false;
    windGroup.add(wind);

    const entryParticles = createWindEntryParticles({
        random,
        windStartX,
        toDisplayPoint,
    });
    windGroup.add(entryParticles.points);

    const auroraUniforms = {
        time: {
            value: 0,
        },
        activity: {
            value: 0,
        },
        towardSun: {
            value: new Vector3(1, 0, 0),
        },
        magneticNorth: {
            value: magneticNorth,
        },
        landings: {
            value: createArray(auroraLandingCount, () => new Vector3()),
        },
    };
    const auroraMaterial = new ShaderMaterial({
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        uniforms: auroraUniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        clipping: true,
        clippingPlanes: cutPlanes,
        clipIntersection: true,
    });
    const auroraRingVertexCount = (auroraSegments + 1) * 2;
    const auroraGeometry = new BufferGeometry();
    auroraGeometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(auroraRingVertexCount * 2 * 3), 3),
    );
    auroraGeometry.setAttribute(
        'ringAngle',
        new BufferAttribute(
            new Float32Array(
                createArray(2, () => {
                    return createArray(auroraSegments + 1, (index) => {
                        const angle = (index / auroraSegments) * Math.PI * 2;
                        return [
                            angle,
                            angle,
                        ];
                    }).flat();
                }).flat(),
            ),
            1,
        ),
    );
    auroraGeometry.setAttribute(
        'height',
        new BufferAttribute(
            new Float32Array(createArray(auroraRingVertexCount * 2, (index) => index % 2)),
            1,
        ),
    );
    auroraGeometry.setIndex(
        createArray(2, (ring) => {
            return createArray(auroraSegments, (segment) => {
                const bottom = ring * auroraRingVertexCount + segment * 2;
                return [
                    bottom,
                    bottom + 2,
                    bottom + 1,
                    bottom + 1,
                    bottom + 2,
                    bottom + 3,
                ];
            }).flat();
        }).flat(),
    );
    const aurora = new Mesh(auroraGeometry, auroraMaterial);
    aurora.frustumCulled = false;
    aurora.renderOrder = 4;
    group.add(aurora);

    const current: {
        /** The set of lines being traced over several frames. */
        pendingTrace:
            | {
                  magnetosphere: Magnetosphere;
                  seeds: FieldLineSeed[];
                  lines: FieldLine[];
                  inputs: ReturnType<typeof getTraceInputs>;
              }
            | undefined;
        lines: FieldLine[];
        /** What the drawn lines were traced with, to skip retracing while those barely change. */
        shownTraceInputs:
            | {
                  tilt: number;
                  dynamicPressureNanopascals: number;
                  fieldZNanotesla: number;
              }
            | undefined;
        dashOffset: number;
        windTraveledRadii: number;
        /** Recent particle landings, in the planet's frame, newest last. */
        landings: {
            direction: Vector3;
            seconds: number;
        }[];
    } = {
        pendingTrace: undefined,
        lines: [],
        shownTraceInputs: undefined,
        dashOffset: 0,
        windTraveledRadii: 0,
        landings: [],
    };

    function createCurrentMagnetosphere({
        towardSun,
        conditions,
    }: Readonly<{
        towardSun: Readonly<Vector3>;
        conditions: Readonly<SolarWindConditions>;
    }>) {
        return createMagnetosphere({
            sunDirection: towardSun,
            magneticNorth,
            surfaceFieldNanotesla: magneticDipole.equatorialSurfaceFieldNanotesla,
            dynamicPressureNanopascals: conditions.dynamicPressureNanopascals,
            fieldZNanotesla: conditions.fieldZNanotesla,
        });
    }

    /** Swaps in a fully traced set of lines and the boundaries they were traced with. */
    function showTrace({
        magnetosphere,
        seeds,
        lines,
    }: Readonly<{
        magnetosphere: Readonly<Magnetosphere>;
        seeds: ReadonlyArray<Readonly<FieldLineSeed>>;
        lines: ReadonlyArray<FieldLine>;
    }>) {
        entryParticles.setLines({
            lines,
            seeds,
            north: magnetosphere.dipoleMoment.clone().normalize().negate(),
        });
        current.lines = lines.map((line) => {
            return {
                ...line,
                points: simplifyLine(line.points).map(toDisplayPoint),
            };
        });

        const segments = current.lines.flatMap((line, lineIndex) => {
            const lengths = line.points.slice(1).map((point, index) => {
                return point.distanceTo(assertWrap.isDefined(line.points[index]));
            });
            const distances = lengths.reduce<number[]>(
                (sums, length) => {
                    return [
                        ...sums,
                        assertWrap.isDefined(sums.at(-1)) + length,
                    ];
                },
                [
                    0,
                ],
            );
            /**
             * Dashes are placed by distance from the line's surface foot, which stays put between
             * traces. `LineSegments2.computeLineDistances` instead sums across every line, so any
             * line changing length would slide the dashes on all the lines after it.
             */
            const footOffset = assertWrap.isDefined(seeds[lineIndex]).isNorth
                ? assertWrap.isDefined(distances.at(-1))
                : 0;
            return line.points.slice(1).map((point, index) => {
                return {
                    start: assertWrap.isDefined(line.points[index]),
                    end: point,
                    startDistance: assertWrap.isDefined(distances[index]) - footOffset,
                    endDistance: assertWrap.isDefined(distances[index + 1]) - footOffset,
                    color: line.isClosed ? fieldLineColors.closed : fieldLineColors.open,
                };
            });
        });
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(
            segments.flatMap(({start, end}) => {
                return [
                    start.x,
                    start.y,
                    start.z,
                    end.x,
                    end.y,
                    end.z,
                ];
            }),
        );
        geometry.setColors(
            segments.flatMap(({color}) => {
                return [
                    color.r,
                    color.g,
                    color.b,
                    color.r,
                    color.g,
                    color.b,
                ];
            }),
        );
        const distanceBuffer = new InstancedInterleavedBuffer(
            new Float32Array(
                segments.flatMap(({startDistance, endDistance}) => {
                    return [
                        startDistance,
                        endDistance,
                    ];
                }),
            ),
            2,
            1,
        );
        geometry.setAttribute(
            'instanceDistanceStart',
            new InterleavedBufferAttribute(distanceBuffer, 1, 0),
        );
        geometry.setAttribute(
            'instanceDistanceEnd',
            new InterleavedBufferAttribute(distanceBuffer, 1, 1),
        );
        fieldLines.geometry.dispose();
        fieldLines.geometry = geometry;

        [
            {
                shell: magnetopause,
                shape: magnetosphere.magnetopause,
            },
            {
                shell: bowShock,
                shape: magnetosphere.bowShock,
            },
        ].forEach(({shell, shape}) => {
            shell.geometry.dispose();
            shell.geometry = createBoundaryGeometry(shape);
        });

        windUniforms.magnetopauseRadii.value = getBoundaryCylinderRadii({
            shape: magnetosphere.magnetopause,
            minX: windEndX,
            maxX: windStartX,
            count: windRadiusSampleCount,
        });
        windUniforms.shockRadii.value = getBoundaryCylinderRadii({
            shape: magnetosphere.bowShock,
            minX: windEndX,
            maxX: windStartX,
            count: windRadiusSampleCount,
        });
    }

    /**
     * The lines' shape in the magnetosphere frame only depends on these. Turning with the Sun and
     * the planet's spin is handled by rotating `magnetosphereGroup`.
     */
    function getTraceInputs(
        params: Readonly<{
            towardSun: Readonly<Vector3>;
            conditions: Readonly<SolarWindConditions>;
        }>,
    ) {
        return {
            tilt: Math.asin(magneticNorth.dot(params.towardSun.clone().normalize())),
            dynamicPressureNanopascals: params.conditions.dynamicPressureNanopascals,
            fieldZNanotesla: params.conditions.fieldZNanotesla,
        };
    }

    /** Traces the next few lines, starting a new set from the current conditions when needed. */
    function continueTrace(
        params: Readonly<{
            towardSun: Readonly<Vector3>;
            conditions: Readonly<SolarWindConditions>;
        }>,
    ) {
        const inputs = getTraceInputs(params);
        const shown = current.shownTraceInputs;
        if (
            !current.pendingTrace &&
            shown &&
            Math.abs(inputs.tilt - shown.tilt) < MathUtils.degToRad(0.5) &&
            Math.abs(inputs.dynamicPressureNanopascals / shown.dynamicPressureNanopascals - 1) <
                0.03 &&
            Math.abs(inputs.fieldZNanotesla - shown.fieldZNanotesla) < 0.5
        ) {
            return;
        }
        const magnetosphere =
            current.pendingTrace?.magnetosphere ?? createCurrentMagnetosphere(params);
        const pendingTrace = current.pendingTrace ?? {
            magnetosphere,
            seeds: getFieldLineSeeds(magnetosphere),
            lines: [],
            inputs,
        };
        const lines = [
            ...pendingTrace.lines,
            ...pendingTrace.seeds
                .slice(pendingTrace.lines.length, pendingTrace.lines.length + linesTracedPerFrame)
                .map((seed) => {
                    return traceSeededFieldLine({
                        magnetosphere,
                        seed,
                    });
                }),
        ];
        if (lines.length < pendingTrace.seeds.length) {
            current.pendingTrace = {
                ...pendingTrace,
                lines,
            };
            return;
        }
        current.pendingTrace = undefined;
        current.shownTraceInputs = pendingTrace.inputs;
        showTrace({
            magnetosphere,
            seeds: pendingTrace.seeds,
            lines,
        });
    }

    /** Directions from the magnetic pole toward local midnight and dawn. */
    function getAuroraBasis(towardSun: Readonly<Vector3>) {
        const midnight = towardSun
            .clone()
            .addScaledVector(magneticNorth, -towardSun.dot(magneticNorth))
            .normalize()
            .negate();
        return {
            midnight,
            dawnward: magneticNorth.clone().cross(midnight),
        };
    }

    /**
     * The auroral ovals sit around each magnetic pole, closer to the equator on the night side, and
     * spread toward the equator as activity rises.
     */
    function updateAurora({
        towardSun,
        activity,
    }: Readonly<{
        towardSun: Readonly<Vector3>;
        activity: number;
    }>) {
        const positions = auroraGeometry.getAttribute('position');
        const {midnight, dawnward} = getAuroraBasis(towardSun);
        const radii = [
            100,
            300,
        ].map((altitudeKm) => {
            return toDisplayRadius({
                scale: radialScale,
                realKm: surfaceRadiusKm + altitudeKm,
            });
        });
        [
            1,
            -1,
        ].forEach((hemisphere, ringIndex) => {
            createArray(auroraSegments + 1, (index) => index).forEach((index) => {
                const angle = (index / auroraSegments) * Math.PI * 2;
                const colatitude = ((19 + 4 * Math.cos(angle) + 6 * activity) * Math.PI) / 180;
                const direction = magneticNorth
                    .clone()
                    .multiplyScalar(hemisphere * Math.cos(colatitude))
                    .addScaledVector(midnight, Math.sin(colatitude) * Math.cos(angle))
                    .addScaledVector(dawnward, Math.sin(colatitude) * Math.sin(angle));
                radii.forEach((radius, heightIndex) => {
                    const vertex = direction.clone().multiplyScalar(radius);
                    positions.setXYZ(
                        ringIndex * auroraRingVertexCount + index * 2 + heightIndex,
                        vertex.x,
                        vertex.y,
                        vertex.z,
                    );
                });
            });
        });
        positions.needsUpdate = true;
    }

    return {
        group,
        /**
         * Sets the field lines' opacity, from 0 to 1. Everything else but the aurora brightens and
         * dims with them, at its normal brightness at the default opacity.
         */
        setFieldOpacity(opacity: number) {
            const brightness = opacity / defaultFieldOpacity;
            fieldGroup.visible = opacity > 0;
            fieldLineMaterial.opacity = opacity;
            windUniforms.brightness.value = brightness;
            entryParticles.setBrightness(brightness);
            assertWrap.isDefined(magnetopauseMaterial.uniforms.intensity).value =
                shellIntensities.magnetopause * brightness;
            assertWrap.isDefined(bowShockMaterial.uniforms.intensity).value =
                shellIntensities.bowShock * brightness;
        },
        setDisabledEffects(disabledEffects: ReadonlyArray<RenderEffect>) {
            wind.visible = !disabledEffects.includes(RenderEffect.SolarWind);
            aurora.visible = !disabledEffects.includes(RenderEffect.Aurora);
        },
        update({
            towardSun,
            conditions,
            animationSeconds,
            frameSeconds,
            resolution,
            pixelRatio,
        }: Readonly<{
            /** In the planet's frame. */
            towardSun: Readonly<Vector3>;
            conditions: Readonly<SolarWindConditions>;
            animationSeconds: number;
            frameSeconds: number;
            /** The drawing buffer's size in pixels. */
            resolution: Readonly<Vector2>;
            pixelRatio: number;
        }>) {
            continueTrace({
                towardSun,
                conditions,
            });
            const axes = createCurrentMagnetosphere({
                towardSun,
                conditions,
            }).axes;
            /**
             * The shown lines were traced at an older tilt, which drifts quickly when time runs
             * fast. Tilting them by the difference keeps their poles on the planet's magnetic poles
             * until the next trace is swapped in, instead of snapping each time one is.
             */
            const tiltDrift = current.shownTraceInputs
                ? getTraceInputs({
                      towardSun,
                      conditions,
                  }).tilt - current.shownTraceInputs.tilt
                : 0;
            magnetosphereGroup.quaternion
                .setFromRotationMatrix(new Matrix4().makeBasis(axes.x, axes.y, axes.z))
                .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tiltDrift));
            const windNorth = new Vector3(0, 1, 0).addScaledVector(axes.x, -axes.x.y).normalize();
            windGroup.quaternion.setFromRotationMatrix(
                new Matrix4().makeBasis(axes.x, windNorth.clone().cross(axes.x), windNorth),
            );
            updateAurora({
                towardSun,
                activity: conditions.activity,
            });
            current.dashOffset -=
                frameSeconds * surfaceRadiusKm * (conditions.speedKmPerSecond / 400);
            fieldLineMaterial.dashOffset = current.dashOffset;
            fieldLineMaterial.resolution.copy(resolution);

            /**
             * Accumulated rather than computed as time times speed, which would jump every particle
             * whenever the speed changes.
             */
            const windSpeedRadii = 5 * (conditions.speedKmPerSecond / 400);
            current.windTraveledRadii += frameSeconds * windSpeedRadii;
            windUniforms.traveled.value = current.windTraveledRadii;
            windUniforms.visibleFraction.value = Math.min(
                1,
                Math.max(0.08, conditions.density / 20),
            );
            windUniforms.pointSize.value = 2 * pixelRatio;

            auroraUniforms.time.value = animationSeconds;
            auroraUniforms.activity.value = conditions.activity;
            auroraUniforms.towardSun.value.copy(towardSun);

            const landings = entryParticles.update({
                frameSeconds,
                windSpeedRadii,
                activity: conditions.activity,
                gsmToWind: windGroup.quaternion
                    .clone()
                    .invert()
                    .multiply(magnetosphereGroup.quaternion),
                getMagnetopauseRadius(x) {
                    const radii = windUniforms.magnetopauseRadii.value;
                    const index = ((windStartX - x) / (windStartX - windEndX)) * (radii.length - 1);
                    const lower = radii[Math.floor(index)] ?? 0;
                    return MathUtils.lerp(
                        lower,
                        radii[Math.ceil(index)] ?? lower,
                        index - Math.floor(index),
                    );
                },
                isFootHidden(foot) {
                    /** The cut planes pass through the planet's center, so a direction is enough. */
                    const direction = foot
                        .clone()
                        .applyQuaternion(magnetosphereGroup.quaternion)
                        .normalize();
                    return cutPlanes.every((plane) => plane.distanceToPoint(direction) < 0);
                },
                pixelRatio,
            });
            current.landings = [
                ...current.landings,
                ...landings.map((foot) => {
                    return {
                        direction: foot.applyQuaternion(magnetosphereGroup.quaternion).normalize(),
                        seconds: 0,
                    };
                }),
            ]
                .map((landing) => {
                    return {
                        ...landing,
                        seconds: landing.seconds + frameSeconds,
                    };
                })
                .filter((landing) => landing.seconds < auroraLandingSeconds)
                .slice(-auroraLandingCount);
            const {midnight, dawnward} = getAuroraBasis(towardSun);
            auroraUniforms.landings.value.forEach((uniform, index) => {
                const landing = current.landings[index];
                if (landing) {
                    uniform.set(
                        Math.atan2(
                            landing.direction.dot(dawnward),
                            landing.direction.dot(midnight),
                        ),
                        Math.sign(landing.direction.dot(magneticNorth)),
                        (1 - landing.seconds / auroraLandingSeconds) ** 2,
                    );
                } else {
                    uniform.setZ(0);
                }
            });
        },
        dispose() {
            [
                fieldLines.geometry,
                magnetopause.geometry,
                bowShock.geometry,
                windGeometry,
                auroraGeometry,
            ].forEach((geometry) => {
                geometry.dispose();
            });
            [
                fieldLineMaterial,
                magnetopauseMaterial,
                bowShockMaterial,
                windMaterial,
                auroraMaterial,
            ].forEach((material) => {
                material.dispose();
            });
            entryParticles.dispose();
        },
    };
}

export type MagnetosphereModel = ReturnType<typeof createMagnetosphereModel>;
