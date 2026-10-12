// cspell:words fract
import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Group,
    LinearFilter,
    LinearMipmapLinearFilter,
    MathUtils,
    Mesh,
    OrthographicCamera,
    type Plane,
    PlaneGeometry,
    RepeatWrapping,
    Scene,
    ShaderMaterial,
    type Texture,
    Vector2,
    Vector3,
    type WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import {latitudeLongitudeToDirection} from '../../physics/frames.js';
import {noiseShaderChunk} from './noise-shader-chunk.js';

/** How many active regions (sunspot groups with loops above them) can show at once. */
const regionCount = 10;
const loopsPerRegion = 7;
const loopSegments = 48;
/** The layers this model draws, in the order of the `layerSelections` uniform. */
const sunLayerIds = [
    'photosphere',
    'chromosphere',
    'corona',
];
const bakeWidth = 2048;
const bakeHeight = 1024;
/** How many seconds of boiling separate one photosphere bake from the next. */
const bakePeriodSeconds = 1;

/** How far out the corona is drawn, in the Sun's radii. */
const coronaExtent = 4;

const shaderDefines = {
    REGION_COUNT: regionCount,
    LOOP_COUNT: loopsPerRegion.toFixed(1),
    CORONA_EXTENT: coronaExtent.toFixed(1),
    /** The tallest spicules, in the limb's radii. */
    SPICULE_MAX: '1.03',
    /** The range of photosphere heat that fits in a baked texel. */
    HEAT_MIN: '0.4',
    HEAT_SPAN: '0.8',
};

/**
 * How the layers show the layer selection, matching the cut face: a selected layer pulses brighter
 * and the others grey out. Glowing layers add their light, so they brighten rather than blend
 * toward white, which would light up the empty space around them.
 */
const layerSelectionShaderChunk = /* glsl */ `
    vec3 dimLayer(vec3 color, float selection) {
        float isDimmed = step(0.5, -selection);
        return mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), isDimmed * 0.6) * mix(1.0, 0.3, isDimmed);
    }

    vec3 highlightGlowingLayer(vec3 color, float selection) {
        float strength = step(0.5, selection) * glow * 10.0;
        vec3 whiter = mix(color, vec3(max(color.r, max(color.g, color.b))), min(strength, 1.0));
        return dimLayer(whiter * (1.0 + strength), selection);
    }
`;

const photosphereBakeVertexShader = /* glsl */ `
    uniform float stripStart;
    uniform float stripEnd;

    void main() {
        gl_Position = vec4(position.x, mix(stripStart, stripEnd, position.y * 0.5 + 0.5) * 2.0 - 1.0, 0.0, 1.0);
    }
`;

/**
 * Boiling granules over a slower, larger churn, with sunspots and bright faculae in each active
 * region, baked into a latitude and longitude map that matches the surface's UVs. Each texel holds
 * the heat, the sunspot umbra and penumbra, and the faculae.
 */
const photosphereBakeFragmentShader = /* glsl */ `
    #include <common>

    uniform float time;
    uniform vec2 bakeSize;
    uniform vec3 regionCenters[REGION_COUNT];
    uniform vec3 regionAxes[REGION_COUNT];
    uniform float regionSizes[REGION_COUNT];

    ${noiseShaderChunk}

    /** How much of a spot's dark center and its streaky rim cover this point. */
    vec2 sunspot(vec3 direction, vec3 spotCenter, float radius, float seed) {
        vec3 offset = direction - spotCenter;
        float gap = length(offset);
        if (gap > radius * 1.5) {
            return vec2(0.0);
        }
        vec3 around = offset / max(gap, 1e-6);
        float ragged = radius * (1.0 + 0.25 * simplexNoise(around * 3.0 + seed));
        float filaments = simplexNoise(around * 40.0 + vec3(seed, 0.0, time * 0.04));
        float penumbra = 1.0 - smoothstep(ragged * 0.9, ragged, gap);
        float umbra = 1.0 - smoothstep(ragged * 0.38, ragged * 0.45, gap);
        return vec2(umbra, penumbra * (0.75 + 0.25 * filaments));
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / bakeSize;
        float longitude = (uv.x * 2.0 - 1.0) * PI;
        float latitude = (uv.y - 0.5) * PI;
        vec3 direction = vec3(cos(latitude) * cos(longitude), sin(latitude), -cos(latitude) * sin(longitude));

        vec3 warp = vec3(
            fbm(direction * 6.0 + vec3(0.0, 0.0, time * 0.03)),
            fbm(direction * 6.0 + vec3(4.1, 1.7, -time * 0.025)),
            0.0
        );
        vec2 churn = cells(direction * 18.0 + warp, time * 0.15);
        float churnLanes = smoothstep(0.0, 0.15, churn.y - churn.x);
        vec2 nearest = cells(direction * 70.0 + warp * 0.6, time * 0.6);
        float granules = (1.0 - smoothstep(0.0, 0.75, nearest.x)) * smoothstep(0.0, 0.1, nearest.y - nearest.x);
        float heat = 0.6 + 0.26 * granules + 0.12 * churnLanes + 0.1 * fbm(direction * 14.0 + warp);

        vec2 shade = vec2(0.0);
        float faculaeMask = 0.0;
        for (int index = 0; index < REGION_COUNT; index++) {
            float size = regionSizes[index];
            vec3 center = regionCenters[index];
            if (size <= 0.0 || length(direction - center) > size * 4.0) {
                continue;
            }
            vec3 axis = regionAxes[index];
            vec3 side = cross(center, axis);
            float seed = float(index) * 7.31;
            faculaeMask = max(faculaeMask, 1.0 - smoothstep(size * 1.5, size * 4.0, length(direction - center)));
            shade = max(shade, sunspot(direction, center + axis * size * 0.9, size * 0.6, seed));
            shade = max(shade, sunspot(direction, center - axis * size, size * 0.42, seed + 3.1));
            shade = max(shade, sunspot(direction, center + side * size * 0.45 - axis * size * 0.2, size * 0.18, seed + 5.7));
        }
        float faculae = faculaeMask * smoothstep(0.0, 0.6, fbm(direction * 40.0)) * (1.0 - shade.y);

        gl_FragColor = vec4((heat - HEAT_MIN) / HEAT_SPAN, shade, faculae);
    }
`;

const photosphereVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    varying vec2 vUv;
    varying vec3 vDirection;
    varying vec3 vNormal;
    varying vec3 vViewDirection;

    void main() {
        vUv = uv;
        vDirection = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <clipping_planes_vertex>
    }
`;

/**
 * Colors the baked surface, fading between the two latest bakes, darker and redder toward the limb,
 * with the flash of a flare. The mipmaps fade granules too small to see into their average.
 */
const photosphereFragmentShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    uniform float time;
    uniform sampler2D bakedPrevious;
    uniform sampler2D bakedNext;
    uniform float bakeBlend;
    uniform vec3 flarePosition;
    uniform float flareIntensity;
    uniform vec3 layerSelections;
    uniform float glow;

    varying vec2 vUv;
    varying vec3 vDirection;
    varying vec3 vNormal;
    varying vec3 vViewDirection;

    ${noiseShaderChunk}
    ${layerSelectionShaderChunk}

    /** Deep orange through yellow to white. */
    vec3 photosphereColor(float heat) {
        vec3 color = mix(vec3(0.7, 0.2, 0.02), vec3(1.0, 0.72, 0.22), smoothstep(0.45, 0.9, heat));
        return mix(color, vec3(1.0, 0.95, 0.75), smoothstep(0.88, 1.05, heat));
    }

    void main() {
        #include <clipping_planes_fragment>
        #include <logdepthbuf_fragment>
        vec3 direction = normalize(vDirection);
        float facing = clamp(dot(normalize(vNormal), normalize(vViewDirection)), 0.0, 1.0);
        vec4 baked = mix(texture2D(bakedPrevious, vUv), texture2D(bakedNext, vUv), bakeBlend);
        float heat = HEAT_MIN + HEAT_SPAN * baked.r;

        vec3 color = photosphereColor(heat);
        color = mix(color, color * vec3(0.55, 0.38, 0.25), baked.b);
        color = mix(color, vec3(0.16, 0.05, 0.02), baked.g);
        /** Faculae are hard to see face on and stand out near the limb. */
        color += vec3(0.35, 0.28, 0.18) * baked.a * (0.2 + 1.2 * (1.0 - facing));
        color *= (1.0 - 0.62 * (1.0 - pow(facing, 0.8))) * vec3(1.0, 0.8 + 0.2 * facing, 0.55 + 0.45 * facing);

        float flareGap = length(direction - flarePosition);
        float flare = flareIntensity * exp(-flareGap * flareGap / 0.0006);
        if (flare > 0.001) {
            flare *= 0.6 + 0.4 * simplexNoise(direction * 200.0 + vec3(time));
            color += vec3(1.0, 0.95, 0.85) * flare * 2.5;
        }
        color = min(color, vec3(1.0));
        color = mix(color, vec3(1.0), step(0.5, layerSelections.x) * glow);
        color = dimLayer(color, layerSelections.x);

        /** Colors are picked as they should show on screen, so they skip the color space change. */
        gl_FragColor = vec4(color, 1.0);
    }
`;

/**
 * Where the corona's point on the limb, behind the given direction in the camera-facing plane, sits
 * in view space, and how far inside the cut it is.
 */
const limbCutShaderChunk = /* glsl */ `
    uniform float drawnRadius;
    #if NUM_CLIPPING_PLANES > 0
        uniform vec4 clippingPlanes[NUM_CLIPPING_PLANES];
    #endif

    /** From 0 outside the cut to 1 inside, blurred across the given share of the Sun's radius. */
    float getLimbCut(vec3 center, vec2 offset, float softness) {
        #if NUM_CLIPPING_PLANES > 0
            float centerDistance = length(center);
            vec3 toCamera = -center / centerDistance;
            vec3 across = vec3(normalize(offset), 0.0);
            across = normalize(across - toCamera * dot(across, toCamera));
            float ratio = min(drawnRadius / centerDistance, 1.0);
            vec3 limb = center + toCamera * drawnRadius * ratio + across * drawnRadius * sqrt(1.0 - ratio * ratio);
            float blur = softness * drawnRadius;
            float cut = 1.0;
            #pragma unroll_loop_start
            for (int i = 0; i < NUM_CLIPPING_PLANES; i++) {
                cut *= smoothstep(-blur, blur, dot(-limb, clippingPlanes[i].xyz) - clippingPlanes[i].w);
            }
            #pragma unroll_loop_end
            return cut;
        #else
            return 0.0;
        #endif
    }
`;

/**
 * The rays only change with direction, so they're found per vertex of a ring that is fine around
 * and coarse outward, leaving each pixel only the falloff.
 */
const coronaVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    /** Where the limb appears in the plane through the Sun's center that faces the camera. */
    uniform float limbRadius;
    uniform float time;

    varying vec2 vOffset;
    varying vec3 vDirection;
    varying vec3 vCenter;
    varying float vRays;

    ${noiseShaderChunk}
    ${limbCutShaderChunk}

    void main() {
        vOffset = position.xy;
        vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 direction = normalize(transpose(mat3(viewMatrix)) * vec3(position.xy, 0.0));
        vDirection = direction;
        float streamers = smoothstep(-0.2, 0.6, fbm(direction * 2.5 + vec3(0.0, 0.0, time * 0.01)))
            * (0.35 + 0.65 * (1.0 - abs(direction.y)));
        float rays = 0.8 + 0.2 * simplexNoise(direction * 18.0 + vec3(time * 0.02));
        vRays = (0.45 + 0.9 * streamers) * rays * (1.0 - getLimbCut(vCenter, vOffset, 0.3));
        vec4 mvPosition = vec4(vCenter, 1.0) + vec4(vOffset * limbRadius, 0.0, 0.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
    }
`;

/**
 * Faint rays that stream out along fixed directions, strongest around the equator, over a thin pink
 * rim of flickering spicules. It draws nothing over the disc, so it never washes out the cut. It is
 * a flat ring facing the camera, so it hides itself wherever the limb behind it has been cut away.
 */
const coronaFragmentShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>

    uniform float time;
    uniform vec3 layerSelections;
    uniform float glow;

    varying vec2 vOffset;
    varying vec3 vDirection;
    varying vec3 vCenter;
    varying float vRays;

    ${noiseShaderChunk}
    ${layerSelectionShaderChunk}
    ${limbCutShaderChunk}

    void main() {
        #include <logdepthbuf_fragment>
        float radius = length(vOffset);
        float falloff = 0.9 * exp(-(radius - 1.0) * 5.0) + 0.2 * pow(radius, -2.5);
        float coronaGlow = falloff * vRays * (1.0 - smoothstep(CORONA_EXTENT * 0.6, CORONA_EXTENT, radius));
        vec3 color = highlightGlowingLayer(vec3(1.0, 0.82, 0.6) * coronaGlow * 0.55, layerSelections.z);
        if (radius < SPICULE_MAX) {
            vec3 direction = normalize(vDirection);
            float spiculeTop = 1.012 + 0.012 * simplexNoise(direction * 120.0 + vec3(0.0, 0.0, time * 0.6));
            float chromosphere = (1.0 - smoothstep(spiculeTop - 0.004, spiculeTop, radius)) * smoothstep(0.98, 1.0, radius)
                * (1.0 - getLimbCut(vCenter, vOffset, 0.002));
            color += highlightGlowingLayer(vec3(1.0, 0.35, 0.45) * chromosphere * 0.8, layerSelections.y);
        }
        gl_FragColor = vec4(color, 1.0);
    }
`;

const loopVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    /** The region's index, the loop's index in its region, how far along the loop, and which edge. */
    attribute vec4 loopVertex;

    uniform float time;
    uniform vec3 regionCenters[REGION_COUNT];
    uniform vec3 regionAxes[REGION_COUNT];
    uniform float regionSizes[REGION_COUNT];
    uniform float regionProminences[REGION_COUNT];
    uniform float flareRegion;
    uniform float flareAge;
    uniform float flareIntensity;
    uniform float bodyRadius;
    uniform float ribbonWidth;

    varying float vProgress;
    varying float vEdge;
    varying float vSeed;
    varying float vBrightness;
    varying float vProminence;

    float loopHash(float seed) {
        return fract(sin(seed) * 43758.5453);
    }

    /** A point along the loop, in the Sun's frame. */
    vec3 loopPoint(vec3 center, vec3 axis, vec3 side, float spread, float span, float height, float bow, float progress) {
        vec3 foot = center + side * spread;
        vec3 base = normalize(foot + axis * span * (2.0 * progress - 1.0) + side * bow * sin(PI * progress));
        return base * (1.0 + height * sin(PI * progress)) * bodyRadius;
    }

    void main() {
        int region = int(loopVertex.x + 0.5);
        float size = regionSizes[region];
        vec3 center = regionCenters[region];
        vec3 axis = regionAxes[region];
        vec3 side = normalize(cross(center, axis));
        float loopIndex = loopVertex.y;
        float seed = loopHash(loopVertex.x * 17.0 + loopIndex * 3.1 + 0.5);
        float prominence = regionProminences[region];
        float isFlaring = 1.0 - step(0.5, abs(loopVertex.x - flareRegion));
        /** The flaring region's first loop lifts off and fades away. */
        float isErupting = isFlaring * (1.0 - step(0.5, loopIndex));
        float rise = isErupting * max(flareAge - 0.2, 0.0);

        float spread = (loopIndex / (LOOP_COUNT - 1.0) - 0.5) * 1.4 * size;
        float span = size * (1.0 + 0.6 * seed);
        float height = span * (0.5 + 0.7 * loopHash(seed * 91.0)) * mix(1.0, 2.4, prominence)
            * (1.0 + rise * rise * 0.8)
            * (1.0 + 0.04 * sin(time * 0.7 + seed * 20.0));
        float bow = span * 0.3 * (seed - 0.5);
        vec3 point = loopPoint(center, axis, side, spread, span, height, bow, loopVertex.z);
        vec3 ahead = loopPoint(center, axis, side, spread, span, height, bow, loopVertex.z + 0.01);

        vec4 mvPosition = modelViewMatrix * vec4(point, 1.0);
        vec3 alongView = (modelViewMatrix * vec4(ahead, 1.0)).xyz - mvPosition.xyz;
        vec3 across = normalize(cross(alongView, mvPosition.xyz));
        mvPosition.xyz += across * ribbonWidth * mix(1.0, 2.5, prominence) * loopVertex.w;

        vProgress = loopVertex.z;
        vEdge = loopVertex.w;
        vSeed = seed;
        vProminence = prominence;
        vBrightness = smoothstep(0.0, 0.01, size)
            * (1.0 + isFlaring * flareIntensity * 3.0)
            * (1.0 - isErupting * smoothstep(0.8, 2.5, flareAge));
        gl_Position = size > 0.0 ? projectionMatrix * mvPosition : vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
        #include <clipping_planes_vertex>
    }
`;

/** Plasma streams along each loop, so its brightness runs in bands that slide along it. */
const loopFragmentShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    uniform float time;
    uniform vec3 layerSelections;
    uniform float glow;

    varying float vProgress;
    varying float vEdge;
    varying float vSeed;
    varying float vBrightness;
    varying float vProminence;

    ${layerSelectionShaderChunk}

    void main() {
        #include <clipping_planes_fragment>
        #include <logdepthbuf_fragment>
        float core = 1.0 - abs(vEdge);
        float flow = 0.55 + 0.45 * sin(vProgress * 40.0 - time * (2.0 + vSeed * 2.0) + vSeed * 20.0);
        vec3 color = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.32, 0.28), vProminence);
        gl_FragColor = vec4(highlightGlowingLayer(color * core * flow * vBrightness, layerSelections.z), 1.0);
    }
`;

function hashNumber(seed: number) {
    const value = Math.sin(seed) * 43_758.5453;
    return value - Math.floor(value);
}

/**
 * One active region: it grows in, sits for a while, and fades out, then comes back somewhere else.
 * Real ones last from days to weeks, so their lifetimes follow the shown time.
 */
function getActiveRegion({slot, daysSinceJ2000}: Readonly<{slot: number; daysSinceJ2000: number}>) {
    const lifetimeDays = 10 + 25 * hashNumber(slot * 12.9898 + 1);
    const cycle = daysSinceJ2000 / lifetimeDays + hashNumber(slot * 78.233 + 2);
    const life = cycle - Math.floor(cycle);
    const seed = slot * 31.7 + Math.floor(cycle) * 5.13;
    const hemisphere = hashNumber(seed + 3) < 0.5 ? -1 : 1;
    const center = latitudeLongitudeToDirection({
        /** Spots stay within a band on either side of the equator. */
        latitudeDegrees: hemisphere * (6 + 28 * hashNumber(seed + 4)),
        longitudeDegrees: -180 + 360 * hashNumber(seed + 5),
    });
    const east = new Vector3(0, 1, 0).cross(center).normalize();
    const north = center.clone().cross(east);
    return {
        center,
        /** From the trailing spot to the leading one, which by Joy's law sits nearer the equator. */
        axis: east
            .addScaledVector(north, -hemisphere * (0.1 + 0.3 * hashNumber(seed + 6)))
            .normalize(),
        /** In radians across the surface, or 0 while the region is gone. */
        size:
            (0.05 + 0.07 * hashNumber(seed + 7)) *
            MathUtils.smoothstep(life, 0, 0.12) *
            (1 - MathUtils.smoothstep(life, 0.55, 1)),
        isProminence: hashNumber(seed + 8) > 0.7,
    };
}

/**
 * Rings around the limb, in the limb's radii, from just inside it out to the corona's edge. They're
 * packed close near the limb, where the glow falls off fastest.
 */
function createCoronaGeometry() {
    const segments = 720;
    const ringRadii = createArray(14, (ring) => {
        return 0.98 + (coronaExtent - 0.98) * (ring / 13) ** 2;
    });
    const positions = ringRadii.flatMap((radius) => {
        return createArray(segments, (segment) => {
            const angle = (2 * Math.PI * segment) / segments;
            return [
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0,
            ];
        }).flat();
    });
    const indices = createArray(ringRadii.length - 1, (ring) => ring).flatMap((ring) => {
        return createArray(segments, (segment) => {
            const inner = ring * segments + segment;
            const innerNext = ring * segments + ((segment + 1) % segments);
            return [
                inner,
                inner + segments,
                innerNext,
                innerNext,
                inner + segments,
                innerNext + segments,
            ];
        }).flat();
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setIndex(indices);
    return geometry;
}

/** Every vertex of every loop, as `loopVertex` values that the vertex shader turns into ribbons. */
function createLoopGeometry() {
    const loopVertexCount = (loopSegments + 1) * 2;
    const loopVertices = createArray(regionCount * loopsPerRegion, (loop) => loop).flatMap(
        (loop) => {
            return createArray(loopSegments + 1, (segment) => segment).flatMap((segment) => {
                return [
                    -1,
                    1,
                ].flatMap((edge) => {
                    return [
                        Math.floor(loop / loopsPerRegion),
                        loop % loopsPerRegion,
                        segment / loopSegments,
                        edge,
                    ];
                });
            });
        },
    );
    const indices = createArray(regionCount * loopsPerRegion, (loop) => loop).flatMap((loop) => {
        return createArray(loopSegments, (segment) => segment).flatMap((segment) => {
            const first = loop * loopVertexCount + segment * 2;
            return [
                first,
                first + 1,
                first + 2,
                first + 2,
                first + 1,
                first + 3,
            ];
        });
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array((loopVertices.length / 4) * 3), 3),
    );
    geometry.setAttribute('loopVertex', new BufferAttribute(new Float32Array(loopVertices), 4));
    geometry.setIndex(indices);
    return geometry;
}

/**
 * Everything that makes the Sun look alive: a boiling surface with sunspots, loops of plasma
 * arching over each active region, flares that flash and throw a loop off, and the corona.
 */
export function createSunModel({radiusKm}: Readonly<{radiusKm: number}>) {
    const group = new Group();
    /** The region arrays are filled by `update`, before the first frame draws. */
    const uniforms = {
        time: {
            value: 0,
        },
        regionCenters: {
            value: [] satisfies Vector3[] as Vector3[],
        },
        regionAxes: {
            value: [] satisfies Vector3[] as Vector3[],
        },
        regionSizes: {
            value: [] satisfies number[] as number[],
        },
        regionProminences: {
            value: [] satisfies number[] as number[],
        },
        flarePosition: {
            value: new Vector3(1, 0, 0),
        },
        flareIntensity: {
            value: 0,
        },
        flareRegion: {
            value: -1,
        },
        flareAge: {
            value: 0,
        },
        bodyRadius: {
            value: radiusKm,
        },
        ribbonWidth: {
            value: 0,
        },
        limbRadius: {
            value: radiusKm,
        },
        drawnRadius: {
            value: radiusKm,
        },
        /** Photosphere, chromosphere, and corona: 1 when selected, -1 when another layer is. */
        layerSelections: {
            value: new Vector3(),
        },
        glow: {
            value: 0,
        },
        bakedPrevious: {
            value: undefined satisfies Texture | undefined as Texture | undefined,
        },
        bakedNext: {
            value: undefined satisfies Texture | undefined as Texture | undefined,
        },
        bakeBlend: {
            value: 0,
        },
    };
    const flare: {
        startSeconds: number;
        nextSeconds: number;
        region: number;
    } = {
        /** Long enough ago to be over. Infinity would turn into NaN in the shaders. */
        startSeconds: -100,
        nextSeconds: 2,
        region: -1,
    };

    /**
     * The surface's noise is far too slow to run for every pixel every frame, so it's baked into a
     * map a few times a second and the surface fades from one bake to the next. Each frame bakes a
     * strip of the bake after next, so no frame pays for a whole bake.
     */
    const bakeUniforms = {
        ...uniforms,
        time: {
            value: 0,
        },
        stripStart: {
            value: 0,
        },
        stripEnd: {
            value: 1,
        },
        bakeSize: {
            value: new Vector2(bakeWidth, bakeHeight),
        },
    };
    const bakeMaterial = new ShaderMaterial({
        vertexShader: photosphereBakeVertexShader,
        fragmentShader: photosphereBakeFragmentShader,
        uniforms: bakeUniforms,
        defines: shaderDefines,
        depthTest: false,
        depthWrite: false,
    });
    const bakeMesh = new Mesh(new PlaneGeometry(2, 2), bakeMaterial);
    bakeMesh.frustumCulled = false;
    const bakeScene = new Scene().add(bakeMesh);
    const bakeCamera = new OrthographicCamera();
    const bake = {
        targets: createArray(3, () => {
            return new WebGLRenderTarget(bakeWidth, bakeHeight, {
                depthBuffer: false,
                generateMipmaps: true,
                minFilter: LinearMipmapLinearFilter,
                magFilter: LinearFilter,
                wrapS: RepeatWrapping,
            });
        }),
        startSeconds: undefined satisfies number | undefined as number | undefined,
        nextRow: 0,
    };

    function bakeRows({
        target,
        seconds,
        fromRow,
        toRow,
        renderer,
    }: Readonly<{
        target: WebGLRenderTarget;
        seconds: number;
        fromRow: number;
        toRow: number;
        renderer: WebGLRenderer;
    }>) {
        if (toRow <= fromRow) {
            return;
        }
        /** Mipmaps are made after each render, so only the strip that finishes a bake makes them. */
        target.texture.generateMipmaps = toRow === bakeHeight;
        bakeUniforms.time.value = seconds;
        bakeUniforms.stripStart.value = fromRow / bakeHeight;
        bakeUniforms.stripEnd.value = toRow / bakeHeight;
        const previousTarget = renderer.getRenderTarget();
        const previousAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setRenderTarget(target);
        renderer.render(bakeScene, bakeCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = previousAutoClear;
    }

    function updateBakes(seconds: number, renderer: WebGLRenderer) {
        const lastStart = bake.startSeconds;
        if (
            lastStart == undefined ||
            seconds < lastStart ||
            seconds >= lastStart + bakePeriodSeconds * 2
        ) {
            bake.startSeconds = seconds;
            bake.nextRow = 0;
            bake.targets.slice(0, 2).forEach((target, index) => {
                bakeRows({
                    target,
                    seconds: seconds + index * bakePeriodSeconds,
                    fromRow: 0,
                    toRow: bakeHeight,
                    renderer,
                });
            });
        } else if (seconds >= lastStart + bakePeriodSeconds) {
            const [
                previous,
                next,
                upcoming,
            ] = bake.targets;
            bakeRows({
                target: assertWrap.isDefined(upcoming),
                seconds: lastStart + bakePeriodSeconds * 2,
                fromRow: bake.nextRow,
                toRow: bakeHeight,
                renderer,
            });
            bake.targets = [
                assertWrap.isDefined(next),
                assertWrap.isDefined(upcoming),
                assertWrap.isDefined(previous),
            ];
            bake.startSeconds = lastStart + bakePeriodSeconds;
            bake.nextRow = 0;
        }
        const startSeconds = assertWrap.isDefined(bake.startSeconds);
        const progress = (seconds - startSeconds) / bakePeriodSeconds;
        /** Running a little ahead leaves room for frames that come late. */
        const toRow = Math.min(bakeHeight, Math.ceil(progress * bakeHeight * 1.25));
        bakeRows({
            target: assertWrap.isDefined(bake.targets[2]),
            seconds: startSeconds + bakePeriodSeconds * 2,
            fromRow: bake.nextRow,
            toRow,
            renderer,
        });
        bake.nextRow = Math.max(bake.nextRow, toRow);
        uniforms.bakedPrevious.value = assertWrap.isDefined(bake.targets[0]).texture;
        uniforms.bakedNext.value = assertWrap.isDefined(bake.targets[1]).texture;
        uniforms.bakeBlend.value = progress;
    }

    const surfaceMaterial = new ShaderMaterial({
        vertexShader: photosphereVertexShader,
        fragmentShader: photosphereFragmentShader,
        uniforms,
        defines: shaderDefines,
        clipping: true,
        clipIntersection: true,
    });

    const coronaMaterial = new ShaderMaterial({
        vertexShader: coronaVertexShader,
        fragmentShader: coronaFragmentShader,
        uniforms,
        defines: shaderDefines,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        clipping: true,
        clipIntersection: true,
    });
    const corona = new Mesh(createCoronaGeometry(), coronaMaterial);
    /** It's placed in the vertex shader, wherever the camera is. */
    corona.frustumCulled = false;
    corona.renderOrder = 2;
    group.add(corona);

    const loopMaterial = new ShaderMaterial({
        vertexShader: loopVertexShader,
        fragmentShader: loopFragmentShader,
        uniforms,
        defines: shaderDefines,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        clipping: true,
        clipIntersection: true,
    });
    const loops = new Mesh(createLoopGeometry(), loopMaterial);
    loops.frustumCulled = false;
    loops.renderOrder = 3;
    group.add(loops);

    return {
        group,
        /** For the layered model's surface. */
        surfaceMaterial,
        /** Clips the surface, loops, and chromosphere to the body's cut. */
        setCutPlanes(cutPlanes: Plane[]) {
            surfaceMaterial.clippingPlanes = cutPlanes;
            loopMaterial.clippingPlanes = cutPlanes;
            coronaMaterial.clippingPlanes = cutPlanes;
        },
        setSelectedLayer(layerId: string | undefined) {
            const selections = sunLayerIds.map((sunLayerId) => {
                return layerId == undefined ? 0 : layerId === sunLayerId ? 1 : -1;
            });
            uniforms.layerSelections.value.fromArray(selections);
        },
        update({
            daysSinceJ2000,
            animationSeconds,
            scale,
            cameraPosition,
            glow,
            renderer,
        }: Readonly<{
            daysSinceJ2000: number;
            /** Wall-clock seconds, which drive the boiling and the flares. */
            animationSeconds: number;
            /** How many times larger than true size the Sun is drawn. */
            scale: number;
            cameraPosition: Readonly<Vector3>;
            /** How strongly the selected layer lights up, from 0 to 1. */
            glow: number;
            /** Bakes the surface's boiling. */
            renderer: WebGLRenderer;
        }>) {
            group.scale.setScalar(scale);
            uniforms.glow.value = glow;
            const regions = createArray(regionCount, (slot) => {
                return getActiveRegion({
                    slot,
                    daysSinceJ2000,
                });
            });
            uniforms.time.value = animationSeconds;
            uniforms.regionCenters.value = regions.map((region) => region.center);
            uniforms.regionAxes.value = regions.map((region) => region.axis);
            uniforms.regionSizes.value = regions.map((region) => region.size);
            uniforms.regionProminences.value = regions.map((region) =>
                region.isProminence ? 1 : 0,
            );

            if (animationSeconds >= flare.nextSeconds) {
                const candidates = regions
                    .map((region, index) => {
                        return {
                            region,
                            index,
                        };
                    })
                    .filter((candidate) => candidate.region.size > 0.02);
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                flare.nextSeconds = animationSeconds + 3 + Math.random() * 7;
                if (chosen) {
                    flare.startSeconds = animationSeconds;
                    flare.region = chosen.index;
                    uniforms.flarePosition.value = chosen.region.center
                        .clone()
                        .addScaledVector(chosen.region.axis, chosen.region.size * 0.3);
                }
            }
            const flareAge = animationSeconds - flare.startSeconds;
            uniforms.flareAge.value = flareAge;
            uniforms.flareRegion.value = flareAge < 6 ? flare.region : -1;
            uniforms.flareIntensity.value =
                flareAge < 0.3 ? flareAge / 0.3 : Math.exp(-(flareAge - 0.3) / 1.2);
            updateBakes(animationSeconds, renderer);

            const drawnRadius = radiusKm * scale;
            uniforms.drawnRadius.value = drawnRadius;
            const cameraDistance = Math.max(cameraPosition.length(), drawnRadius * 1.001);
            uniforms.limbRadius.value =
                (drawnRadius * cameraDistance) / Math.sqrt(cameraDistance ** 2 - drawnRadius ** 2);
            uniforms.ribbonWidth.value = drawnRadius * 0.008;
        },
        /** The surface material is disposed with the layered model that draws it. */
        dispose() {
            corona.geometry.dispose();
            coronaMaterial.dispose();
            loops.geometry.dispose();
            loopMaterial.dispose();
            bakeMesh.geometry.dispose();
            bakeMaterial.dispose();
            bake.targets.forEach((target) => target.dispose());
        },
    };
}

export type SunModel = ReturnType<typeof createSunModel>;
