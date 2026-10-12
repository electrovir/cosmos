import {SRGBColorSpace, TextureLoader, type Texture} from 'three';
import {BodyId} from '../../data/celestial-body.js';
import {earthDataDirName, earthDataFileNames} from '../../data/earth/earth-data-files.js';
import {moonDataDirName, moonDataFileNames} from '../../data/moon/moon-data-files.js';
import {skyDataDirName, skyDataFileNames} from '../../data/sky/sky-data-files.js';
import {parseStarCatalog} from '../../physics/star-catalog.js';
import {parseEarthSurfaceData, type SurfaceData} from '../../physics/surface-data.js';
import {createStaticFileUrl} from '../frontend-state/frontend-state.js';

/** Large files a body's close-up view draws with, which only some bodies have. */
export type BodyAssets = {
    surfaceColor: Texture | undefined;
    surfaceData: SurfaceData | undefined;
};

async function fetchBytes(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load '${url}': ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
}

const bodyAssetLoaders: Record<BodyId, () => Promise<BodyAssets>> = {
    async [BodyId.Earth]() {
        const [
            surfaceColor,
            elevationBytes,
            crustBytes,
        ] = await Promise.all([
            new TextureLoader().loadAsync(
                createStaticFileUrl(earthDataDirName, earthDataFileNames.surfaceColor),
            ),
            fetchBytes(createStaticFileUrl(earthDataDirName, earthDataFileNames.elevation)),
            fetchBytes(createStaticFileUrl(earthDataDirName, earthDataFileNames.crust)),
        ]);
        surfaceColor.colorSpace = SRGBColorSpace;
        return {
            surfaceColor,
            surfaceData: parseEarthSurfaceData({
                elevationBytes,
                crustBytes,
            }),
        };
    },
    [BodyId.Sun]() {
        return Promise.resolve({
            surfaceColor: undefined,
            surfaceData: undefined,
        });
    },
    async [BodyId.Moon]() {
        const surfaceColor = await new TextureLoader().loadAsync(
            createStaticFileUrl(moonDataDirName, moonDataFileNames.surfaceColor),
        );
        surfaceColor.colorSpace = SRGBColorSpace;
        return {
            surfaceColor,
            surfaceData: undefined,
        };
    },
};

async function loadSurfaceColor(...paths: ReadonlyArray<string>) {
    const texture = await new TextureLoader().loadAsync(createStaticFileUrl(...paths));
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

const smallSurfaceColorLoaders: Record<BodyId, (() => Promise<Texture>) | undefined> = {
    [BodyId.Sun]: undefined,
    async [BodyId.Earth]() {
        return await loadSurfaceColor(earthDataDirName, earthDataFileNames.surfaceColorSmall);
    },
    async [BodyId.Moon]() {
        return await loadSurfaceColor(moonDataDirName, moonDataFileNames.surfaceColorSmall);
    },
};

/** A low detail surface image, for drawing the body from afar, if it has one. */
export async function loadSmallSurfaceColor(bodyId: BodyId) {
    return await smallSurfaceColorLoaders[bodyId]?.();
}

export async function loadBodyAssets(bodyId: BodyId) {
    return await bodyAssetLoaders[bodyId]();
}

export async function loadStarCatalog() {
    return parseStarCatalog(
        await fetchBytes(createStaticFileUrl(skyDataDirName, skyDataFileNames.stars)),
    );
}
