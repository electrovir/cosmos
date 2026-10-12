import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Group,
    Points,
    type Quaternion,
    ShaderMaterial,
    Sprite,
    SpriteMaterial,
    type Vector3,
} from 'three';
import {astronomyToScene, equatorialToEcliptic} from '../../physics/frames.js';
import {getStarColor, type Star} from '../../physics/star-catalog.js';

/**
 * How far the stars are drawn from the camera, in kilometers. Anything farther still draws in front
 * of them, since they're drawn first and leave no depth behind.
 */
const skyDistanceKm = 2_000_000;
/** How much wider the Sun's glow is drawn than its disc. */
const sunGlowScale = 10;

const starVertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    attribute vec3 starColor;
    attribute float magnitude;
    uniform float pixelRatio;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        /** The square root of real brightness, so faint stars still show against bright ones. */
        vAlpha = clamp(pow(10.0, -0.2 * (magnitude - 4.0)), 0.0, 1.0);
        gl_PointSize = clamp(4.0 - 0.4 * magnitude, 2.0, 5.5) * pixelRatio;
        vColor = starColor;
        #include <logdepthbuf_vertex>
    }
`;

const starFragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        #include <logdepthbuf_fragment>
        float edge = 1.0 - smoothstep(0.3, 1.0, length(gl_PointCoord - 0.5) * 2.0);
        gl_FragColor = vec4(vColor, vAlpha * edge);
    }
`;

function createSunTexture() {
    const size = 256;
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
        const center = size / 2;
        const discEdge = 1 / sunGlowScale;
        const gradient = context.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(discEdge * 0.9, 'rgba(255, 252, 240, 1)');
        gradient.addColorStop(discEdge * 1.2, 'rgba(255, 230, 180, 0.5)');
        gradient.addColorStop(0.4, 'rgba(255, 200, 120, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 180, 100, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
}

/**
 * The stars, kept centered on the camera so they look infinitely far away, and the Sun at its real
 * place. Everything else in the scene draws in front of them.
 */
export function createSkyModel() {
    const group = new Group();

    const starUniforms = {
        pixelRatio: {
            value: 1,
        },
    };
    const starMaterial = new ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        uniforms: starUniforms,
        /**
         * Kept opaque so they draw before everything else. Transparent objects draw after every
         * opaque one, which would put the stars on top of a body farther away than they are.
         */
        blending: AdditiveBlending,
        depthWrite: false,
    });
    const stars = new Points(new BufferGeometry(), starMaterial);
    stars.frustumCulled = false;
    stars.renderOrder = -1;
    group.add(stars);

    const sunTexture = createSunTexture();
    const sunMaterial = new SpriteMaterial({
        map: sunTexture,
        blending: AdditiveBlending,
        depthWrite: false,
    });
    const sun = new Sprite(sunMaterial);
    sun.renderOrder = -1;
    group.add(sun);

    return {
        group,
        setStars(starList: ReadonlyArray<Readonly<Star>>) {
            const geometry = new BufferGeometry();
            geometry.setAttribute(
                'position',
                new BufferAttribute(
                    new Float32Array(
                        starList.flatMap(({direction}) => {
                            return astronomyToScene(equatorialToEcliptic(direction))
                                .multiplyScalar(skyDistanceKm)
                                .toArray();
                        }),
                    ),
                    3,
                ),
            );
            geometry.setAttribute(
                'starColor',
                new BufferAttribute(
                    new Float32Array(
                        starList.flatMap(({colorIndex}) => {
                            const color = getStarColor(colorIndex);
                            return [
                                color.r,
                                color.g,
                                color.b,
                            ];
                        }),
                    ),
                    3,
                ),
            );
            geometry.setAttribute(
                'magnitude',
                new BufferAttribute(
                    new Float32Array(starList.map(({visualMagnitude}) => visualMagnitude)),
                    1,
                ),
            );
            stars.geometry.dispose();
            stars.geometry = geometry;
        },
        update({
            cameraPosition,
            toBodyFrame,
            sunPosition,
            sunRadiusKm,
            pixelRatio,
        }: Readonly<{
            cameraPosition: Readonly<Vector3>;
            /** Turns the J2000 ecliptic scene frame into the body's frame, which the scene draws in. */
            toBodyFrame: Readonly<Quaternion> | undefined;
            /** In the body's frame, in kilometers. */
            sunPosition: Readonly<Vector3> | undefined;
            sunRadiusKm: number;
            pixelRatio: number;
        }>) {
            group.position.copy(cameraPosition);
            if (toBodyFrame) {
                stars.quaternion.copy(toBodyFrame);
            }
            sun.visible = !!sunPosition;
            if (sunPosition) {
                /** The group follows the camera, so the Sun's place is set relative to it. */
                sun.position.copy(sunPosition).sub(cameraPosition);
                sun.scale.setScalar(2 * sunRadiusKm * sunGlowScale);
            }
            starUniforms.pixelRatio.value = pixelRatio;
        },
        dispose() {
            stars.geometry.dispose();
            starMaterial.dispose();
            sunMaterial.dispose();
            sunTexture.dispose();
        },
    };
}
