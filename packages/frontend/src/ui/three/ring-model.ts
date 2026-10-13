import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    Color,
    DataTexture,
    DoubleSide,
    LinearFilter,
    LinearMipmapLinearFilter,
    Mesh,
    MeshBasicMaterial,
    type Plane,
    RGBAFormat,
    RingGeometry,
    Vector3,
} from 'three';
import {type RingBand} from '../../data/celestial-body.js';
import {createRandom} from '../../physics/solar-wind-weather.js';

/** Fine enough to show the narrowest gaps in the catalog. */
const ringTextureWidth = 4096;

/** Wavelengths of the fine ringlet pattern, in kilometers, from finest to broadest. */
const ringletWavelengthsKm = [
    40,
    150,
    600,
];

/** Seeded value noise from 0 to 1 at each radius, smooth over several wavelengths. */
function createRingletNoise({innerKm, outerKm}: Readonly<{innerKm: number; outerKm: number}>) {
    const random = createRandom(11);
    const octaves = ringletWavelengthsKm.map((wavelengthKm) => {
        return {
            wavelengthKm,
            values: createArray(Math.ceil((outerKm - innerKm) / wavelengthKm) + 2, () => random()),
        };
    });
    return (radiusKm: number) => {
        return (
            octaves.reduce((sum, octave) => {
                const position = (radiusKm - innerKm) / octave.wavelengthKm;
                const index = Math.floor(position);
                const share = position - index;
                const smoothShare = share * share * (3 - 2 * share);
                const low = octave.values[index] ?? 0;
                const high = octave.values[index + 1] ?? low;
                return sum + low + (high - low) * smoothShare;
            }, 0) / octaves.length
        );
    };
}

/**
 * A body's rings, flat in its equatorial plane (the body frame's xz plane), drawn true to size and
 * shadowed by the body. The texture runs from the innermost edge to the outermost, so each band's
 * color and opacity is read by distance from the center.
 */
export function createRingMesh({
    rings,
    bodyRadiusKm,
    clippingPlanes,
}: Readonly<{
    rings: ReadonlyArray<Readonly<RingBand>>;
    /** The body that casts its shadow on the rings. */
    bodyRadiusKm: number;
    clippingPlanes?: Plane[] | undefined;
}>) {
    assert.isLengthAtLeast(rings, 1);
    const innerKm = Math.min(...rings.map((band) => band.radiusKm.min));
    const outerKm = Math.max(...rings.map((band) => band.radiusKm.max));
    const getRingletNoise = createRingletNoise({
        innerKm,
        outerKm,
    });

    const pixels = new Uint8Array(
        createArray(ringTextureWidth, (index) => {
            const radiusKm = innerKm + ((index + 0.5) / ringTextureWidth) * (outerKm - innerKm);
            const band = rings.find((ring) => {
                return radiusKm >= ring.radiusKm.min && radiusKm < ring.radiusKm.max;
            });
            if (!band) {
                return [
                    0,
                    0,
                    0,
                    0,
                ];
            }
            const bandShare =
                (radiusKm - band.radiusKm.min) / (band.radiusKm.max - band.radiusKm.min);
            const ringlet = (getRingletNoise(radiusKm) * 2 - 1) * (band.ringletContrast ?? 0);
            const opacity =
                (band.opacity + ((band.outerOpacity ?? band.opacity) - band.opacity) * bandShare) *
                (1 + ringlet);
            const color = new Color(band.color).multiplyScalar(1 + ringlet * 0.3);
            return [
                color.r,
                color.g,
                color.b,
                opacity,
            ].map((value) => Math.min(255, Math.max(0, Math.round(value * 255))));
        }).flat(),
    );
    const texture = new DataTexture(pixels, ringTextureWidth, 1, RGBAFormat);
    /** From afar, many ringlets fall in each pixel, so they're averaged instead of shimmering. */
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;

    const geometry = new RingGeometry(innerKm, outerKm, 256, 1);
    /** `RingGeometry`'s UVs map the ring onto a square, so they're replaced with distance outward. */
    const positions = geometry.getAttribute('position');
    const uvs = geometry.getAttribute('uv');
    createArray(positions.count, (index) => index).forEach((index) => {
        const radiusKm = Math.hypot(positions.getX(index), positions.getY(index));
        uvs.setXY(index, (radiusKm - innerKm) / (outerKm - innerKm), 0.5);
    });
    uvs.needsUpdate = true;
    geometry.rotateX(-Math.PI / 2);

    const shadowUniforms = {
        towardSun: {
            value: new Vector3(1, 0, 0),
        },
        bodyRadius: {
            value: bodyRadiusKm,
        },
    };
    const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        clippingPlanes: clippingPlanes ?? null,
        clipIntersection: true,
    });
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, shadowUniforms);
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'varying vec3 ringPosition;\nvoid main() {')
            .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nringPosition = position;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                'void main() {',
                /* glsl */ `
                    uniform vec3 towardSun;
                    uniform float bodyRadius;
                    varying vec3 ringPosition;
                    void main() {
                `,
            )
            .replace(
                '#include <map_fragment>',
                /* glsl */ `
                    #include <map_fragment>
                    {
                        float alongSun = dot(ringPosition, towardSun);
                        float fromSunLine = length(ringPosition - alongSun * towardSun);
                        /**
                         * The Sun is about a thousandth of a radian wide from Saturn, so the
                         * shadow's edge blurs across a thousandth of the distance behind the body.
                         */
                        float edgeWidth = max(-alongSun * 0.0005, fwidth(fromSunLine));
                        float lit = alongSun < 0.0
                            ? smoothstep(bodyRadius - edgeWidth, bodyRadius + edgeWidth, fromSunLine)
                            : 1.0;
                        /** Light reflected off the body's night side keeps the shadow from going black. */
                        diffuseColor.rgb *= mix(0.06, 1.0, lit);
                    }
                `,
            );
    };
    const mesh = new Mesh(geometry, material);

    return {
        mesh,
        update({
            towardSun,
        }: Readonly<{
            /** In the rings' frame, which is the body's frame. */
            towardSun: Readonly<Vector3>;
        }>) {
            shadowUniforms.towardSun.value.copy(towardSun).normalize();
        },
        dispose() {
            geometry.dispose();
            material.dispose();
            texture.dispose();
        },
    };
}
