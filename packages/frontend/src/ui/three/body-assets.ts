import {SRGBColorSpace, TextureLoader, type Texture} from 'three';
import {BodyId} from '../../data/celestial-body.js';
import {earthDataDirName, earthDataFileNames} from '../../data/earth/earth-data-files.js';
import {moonDataDirName, moonDataFileNames} from '../../data/moon/moon-data-files.js';
import {skyDataDirName, skyDataFileNames} from '../../data/sky/sky-data-files.js';
import {
    surfaceMapFileNames,
    type SurfaceMapBodyId,
} from '../../data/surface-map/surface-map-files.js';
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

function loadNoAssets() {
    return Promise.resolve({
        surfaceColor: undefined,
        surfaceData: undefined,
    });
}

async function loadSurfaceMapAssets(bodyId: SurfaceMapBodyId) {
    return {
        surfaceColor: await loadSurfaceColor(bodyId, surfaceMapFileNames.surfaceColor),
        surfaceData: undefined,
    };
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
    [BodyId.Sun]: loadNoAssets,
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
    async [BodyId.Mercury]() {
        return await loadSurfaceMapAssets(BodyId.Mercury);
    },
    async [BodyId.Venus]() {
        return await loadSurfaceMapAssets(BodyId.Venus);
    },
    async [BodyId.Mars]() {
        return await loadSurfaceMapAssets(BodyId.Mars);
    },
    async [BodyId.Jupiter]() {
        return await loadSurfaceMapAssets(BodyId.Jupiter);
    },
    async [BodyId.Saturn]() {
        return await loadSurfaceMapAssets(BodyId.Saturn);
    },
    async [BodyId.Uranus]() {
        return await loadSurfaceMapAssets(BodyId.Uranus);
    },
    async [BodyId.Neptune]() {
        return await loadSurfaceMapAssets(BodyId.Neptune);
    },
    async [BodyId.Pluto]() {
        return await loadSurfaceMapAssets(BodyId.Pluto);
    },
    async [BodyId.Phobos]() {
        return await loadSurfaceMapAssets(BodyId.Phobos);
    },
    async [BodyId.Io]() {
        return await loadSurfaceMapAssets(BodyId.Io);
    },
    async [BodyId.Europa]() {
        return await loadSurfaceMapAssets(BodyId.Europa);
    },
    async [BodyId.Ganymede]() {
        return await loadSurfaceMapAssets(BodyId.Ganymede);
    },
    async [BodyId.Callisto]() {
        return await loadSurfaceMapAssets(BodyId.Callisto);
    },
    async [BodyId.Mimas]() {
        return await loadSurfaceMapAssets(BodyId.Mimas);
    },
    async [BodyId.Enceladus]() {
        return await loadSurfaceMapAssets(BodyId.Enceladus);
    },
    async [BodyId.Tethys]() {
        return await loadSurfaceMapAssets(BodyId.Tethys);
    },
    async [BodyId.Dione]() {
        return await loadSurfaceMapAssets(BodyId.Dione);
    },
    async [BodyId.Rhea]() {
        return await loadSurfaceMapAssets(BodyId.Rhea);
    },
    async [BodyId.Titan]() {
        return await loadSurfaceMapAssets(BodyId.Titan);
    },
    async [BodyId.Iapetus]() {
        return await loadSurfaceMapAssets(BodyId.Iapetus);
    },
    async [BodyId.Triton]() {
        return await loadSurfaceMapAssets(BodyId.Triton);
    },
    async [BodyId.Charon]() {
        return await loadSurfaceMapAssets(BodyId.Charon);
    },
    [BodyId.Deimos]: loadNoAssets,
    [BodyId.Miranda]: loadNoAssets,
    [BodyId.Ariel]: loadNoAssets,
    [BodyId.Umbriel]: loadNoAssets,
    [BodyId.Titania]: loadNoAssets,
    [BodyId.Oberon]: loadNoAssets,
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
    async [BodyId.Mercury]() {
        return await loadSurfaceColor(BodyId.Mercury, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Venus]() {
        return await loadSurfaceColor(BodyId.Venus, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Mars]() {
        return await loadSurfaceColor(BodyId.Mars, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Jupiter]() {
        return await loadSurfaceColor(BodyId.Jupiter, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Saturn]() {
        return await loadSurfaceColor(BodyId.Saturn, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Uranus]() {
        return await loadSurfaceColor(BodyId.Uranus, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Neptune]() {
        return await loadSurfaceColor(BodyId.Neptune, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Pluto]() {
        return await loadSurfaceColor(BodyId.Pluto, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Phobos]() {
        return await loadSurfaceColor(BodyId.Phobos, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Io]() {
        return await loadSurfaceColor(BodyId.Io, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Europa]() {
        return await loadSurfaceColor(BodyId.Europa, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Ganymede]() {
        return await loadSurfaceColor(BodyId.Ganymede, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Callisto]() {
        return await loadSurfaceColor(BodyId.Callisto, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Mimas]() {
        return await loadSurfaceColor(BodyId.Mimas, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Enceladus]() {
        return await loadSurfaceColor(BodyId.Enceladus, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Tethys]() {
        return await loadSurfaceColor(BodyId.Tethys, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Dione]() {
        return await loadSurfaceColor(BodyId.Dione, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Rhea]() {
        return await loadSurfaceColor(BodyId.Rhea, surfaceMapFileNames.surfaceColorSmall);
    },
    /** Like Venus, its map is the ground under a haze that hides it from afar. */
    [BodyId.Titan]: undefined,
    async [BodyId.Iapetus]() {
        return await loadSurfaceColor(BodyId.Iapetus, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Triton]() {
        return await loadSurfaceColor(BodyId.Triton, surfaceMapFileNames.surfaceColorSmall);
    },
    async [BodyId.Charon]() {
        return await loadSurfaceColor(BodyId.Charon, surfaceMapFileNames.surfaceColorSmall);
    },
    [BodyId.Deimos]: undefined,
    [BodyId.Miranda]: undefined,
    [BodyId.Ariel]: undefined,
    [BodyId.Umbriel]: undefined,
    [BodyId.Titania]: undefined,
    [BodyId.Oberon]: undefined,
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
