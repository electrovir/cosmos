import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    type IUniform,
    LinearFilter,
    LinearMipmapLinearFilter,
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    type Texture,
    Vector2,
    type WebGLRenderer,
    WebGLRenderTarget,
    type Wrapping,
} from 'three';

const stripVertexShader = /* glsl */ `
    uniform float stripStart;
    uniform float stripEnd;

    void main() {
        gl_Position = vec4(position.x, mix(stripStart, stripEnd, position.y * 0.5 + 0.5) * 2.0 - 1.0, 0.0, 1.0);
    }
`;

/**
 * Bakes a slow, animated fragment shader into a texture every `periodSeconds` so materials can read
 * it instead of running the shader for every pixel every frame. Materials fade from `bakedPrevious`
 * to `bakedNext` by `bakeBlend`. Each frame bakes a strip of the bake after next, so no frame pays
 * for a whole bake.
 *
 * The fragment shader gets `time` and `bakeSize` uniforms and finds its texel from `gl_FragCoord`.
 */
export function createProgressiveBake({
    width,
    height,
    periodSeconds,
    fragmentShader,
    uniforms,
    defines,
    wrapS,
}: Readonly<{
    width: number;
    height: number;
    periodSeconds: number;
    fragmentShader: string;
    uniforms?: Record<string, IUniform> | undefined;
    defines?: Record<string, unknown> | undefined;
    wrapS?: Wrapping | undefined;
}>) {
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
            value: new Vector2(width, height),
        },
    };
    const material = new ShaderMaterial({
        vertexShader: stripVertexShader,
        fragmentShader,
        uniforms: bakeUniforms,
        defines: defines ?? {},
        depthTest: false,
        depthWrite: false,
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const scene = new Scene().add(mesh);
    const camera = new OrthographicCamera();
    const bake = {
        targets: createArray(3, () => {
            return new WebGLRenderTarget(width, height, {
                depthBuffer: false,
                generateMipmaps: true,
                minFilter: LinearMipmapLinearFilter,
                magFilter: LinearFilter,
                wrapS,
            });
        }),
        startSeconds: undefined satisfies number | undefined as number | undefined,
        nextRow: 0,
    };
    const outputUniforms = {
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
        target.texture.generateMipmaps = toRow === height;
        bakeUniforms.time.value = seconds;
        bakeUniforms.stripStart.value = fromRow / height;
        bakeUniforms.stripEnd.value = toRow / height;
        const previousTarget = renderer.getRenderTarget();
        const previousAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = previousAutoClear;
    }

    return {
        /** Spread into a material's uniforms to read the bakes. */
        outputUniforms,
        update(seconds: number, renderer: WebGLRenderer) {
            const lastStart = bake.startSeconds;
            if (
                lastStart == undefined ||
                seconds < lastStart ||
                seconds >= lastStart + periodSeconds * 2
            ) {
                bake.startSeconds = seconds;
                bake.nextRow = 0;
                bake.targets.slice(0, 2).forEach((target, index) => {
                    bakeRows({
                        target,
                        seconds: seconds + index * periodSeconds,
                        fromRow: 0,
                        toRow: height,
                        renderer,
                    });
                });
            } else if (seconds >= lastStart + periodSeconds) {
                const [
                    previous,
                    next,
                    upcoming,
                ] = bake.targets;
                bakeRows({
                    target: assertWrap.isDefined(upcoming),
                    seconds: lastStart + periodSeconds * 2,
                    fromRow: bake.nextRow,
                    toRow: height,
                    renderer,
                });
                bake.targets = [
                    assertWrap.isDefined(next),
                    assertWrap.isDefined(upcoming),
                    assertWrap.isDefined(previous),
                ];
                bake.startSeconds = lastStart + periodSeconds;
                bake.nextRow = 0;
            }
            const startSeconds = assertWrap.isDefined(bake.startSeconds);
            const progress = (seconds - startSeconds) / periodSeconds;
            /** Running a little ahead leaves room for frames that come late. */
            const toRow = Math.min(height, Math.ceil(progress * height * 1.25));
            bakeRows({
                target: assertWrap.isDefined(bake.targets[2]),
                seconds: startSeconds + periodSeconds * 2,
                fromRow: bake.nextRow,
                toRow,
                renderer,
            });
            bake.nextRow = Math.max(bake.nextRow, toRow);
            outputUniforms.bakedPrevious.value = assertWrap.isDefined(bake.targets[0]).texture;
            outputUniforms.bakedNext.value = assertWrap.isDefined(bake.targets[1]).texture;
            outputUniforms.bakeBlend.value = progress;
        },
        dispose() {
            mesh.geometry.dispose();
            material.dispose();
            bake.targets.forEach((target) => target.dispose());
        },
    };
}
