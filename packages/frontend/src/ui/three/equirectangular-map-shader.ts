import {type MeshBasicMaterial, type MeshStandardMaterial} from 'three';

/**
 * GLSL `sampleEquirectangular(map, direction)`, which reads a latitude and longitude map at a
 * direction in the body's frame. Needs three's `<common>` chunk for `PI`.
 *
 * A sphere's interpolated UVs smear into wedges across the triangles that fan around each pole, so
 * the UV is found per pixel instead. Mipmaps pick their level from the widest screen step in
 * texture pixels, and rows of longitude squeeze toward the poles, so the longitude step is measured
 * as distance along the surface to keep the poles from blurring.
 */
export const equirectangularSampleShaderChunk = /* glsl */ `
    vec4 sampleEquirectangular(sampler2D map, vec3 direction) {
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        vec2 uv = vec2(atan(-direction.z, direction.x) / (2.0 * PI) + 0.5, latitude / PI + 0.5);
        vec2 stepX = dFdx(uv);
        vec2 stepY = dFdy(uv);
        /** Undoes the jump where longitude wraps around. */
        stepX.x = (stepX.x - round(stepX.x)) * cos(latitude);
        stepY.x = (stepY.x - round(stepY.x)) * cos(latitude);
        return textureGrad(map, uv, stepX, stepY);
    }
`;

/**
 * Makes a built-in material read its `map` with `sampleEquirectangular`, using the mesh's positions
 * as directions, so the mesh must be centered on the body.
 */
export function sampleMapPerPixel(material: MeshStandardMaterial | MeshBasicMaterial) {
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'varying vec3 mapDirection;\nvoid main() {')
            .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nmapDirection = position;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                'void main() {',
                `varying vec3 mapDirection;\n${equirectangularSampleShaderChunk}\nvoid main() {`,
            )
            .replace(
                '#include <map_fragment>',
                /* glsl */ `
                    #ifdef USE_MAP
                        diffuseColor *= sampleEquirectangular(map, normalize(mapDirection));
                    #endif
                `,
            );
    };
    return material;
}
