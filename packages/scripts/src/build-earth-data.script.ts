// cspell:words etopo topo bathy dods mozjpeg bnds opendap
import {log} from '@augment-vir/common';
import {
    crustBoundaryOrder,
    earthCrustGridSize,
    earthDataFileNames,
    earthElevationGridSize,
    earthSurfaceColorSize,
    earthSurfaceColorSmallSize,
} from '@cosmos/frontend/src/data/earth/earth-data-files.js';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {download} from './download.js';
import {convertCrust1Boundaries} from './earth-data/crust1.js';
import {
    encodeFloat32LittleEndian,
    encodeInt16LittleEndian,
    flipGridRows,
    resampleGridByArea,
} from './earth-data/grid.js';
import {parseDap2Float32Array} from './earth-data/opendap.js';
import {extractTarFile} from './earth-data/tar.js';
import {earthDataOutputDirPath} from './file-paths.js';

/** ETOPO 2022's 60 arc-second grid, in cells. */
const etopoFullSize = {
    width: 21_600,
    height: 10_800,
};
/**
 * Only every this many ETOPO cells are downloaded in each direction, which is still finer than the
 * output grid. Starting at half of it samples near the middle of each skipped block.
 */
const etopoStride = 4;
const etopoStart = etopoStride / 2;

const sources = {
    blueMarble: {
        dirName: 'blue-marble',
        fileName: 'world.topo.bathy.200412.3x5400x2700.jpg',
        url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
    },
    etopo: {
        dirName: 'etopo-2022',
        fileName: `etopo-2022-60s-surface-stride-${etopoStride}.dods`,
        url: [
            'https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc.dods?z',
            `[${etopoStart}:${etopoStride}:${etopoFullSize.height - 1}]`,
            `[${etopoStart}:${etopoStride}:${etopoFullSize.width - 1}]`,
        ].join(''),
    },
    crust1: {
        dirName: 'crust1',
        fileName: 'crust1.0.tar.gz',
        url: 'https://igppweb.ucsd.edu/~gabi/crust1/crust1.0.tar.gz',
    },
} as const;

async function buildSurfaceColor() {
    const sourceBytes = await download(sources.blueMarble);
    await Promise.all(
        [
            {
                size: earthSurfaceColorSize,
                fileName: earthDataFileNames.surfaceColor,
            },
            {
                size: earthSurfaceColorSmallSize,
                fileName: earthDataFileNames.surfaceColorSmall,
            },
        ].map(async ({size, fileName}) => {
            await sharp(sourceBytes)
                .resize(size.width, size.height)
                .jpeg({
                    quality: 85,
                    mozjpeg: true,
                })
                .toFile(join(earthDataOutputDirPath, fileName));
        }),
    );
}

async function buildElevation() {
    const values = parseDap2Float32Array(await download(sources.etopo));
    /** ETOPO's latitudes run from south to north. */
    const elevation = resampleGridByArea({
        grid: flipGridRows({
            values,
            width: etopoFullSize.width / etopoStride,
            height: etopoFullSize.height / etopoStride,
        }),
        ...earthElevationGridSize,
    });
    await writeFile(
        join(earthDataOutputDirPath, earthDataFileNames.elevation),
        encodeInt16LittleEndian(elevation.values),
    );
}

async function buildCrust() {
    const boundariesFile = extractTarFile({
        tarBytes: gunzipSync(await download(sources.crust1)),
        filePath: 'crust1.bnds',
    });
    if (!boundariesFile) {
        throw new Error('CRUST1.0 archive has no crust1.bnds file.');
    }
    const boundaries = convertCrust1Boundaries(Buffer.from(boundariesFile).toString('utf8'));
    await writeFile(
        join(earthDataOutputDirPath, earthDataFileNames.crust),
        encodeFloat32LittleEndian(boundaries),
    );
}

async function main() {
    await mkdir(earthDataOutputDirPath, {
        recursive: true,
    });
    await Promise.all([
        buildSurfaceColor(),
        buildElevation(),
        buildCrust(),
    ]);
    log.success(
        `Wrote ${Object.values(earthDataFileNames).join(', ')} (${earthCrustGridSize.width * earthCrustGridSize.height * crustBoundaryOrder.length} crust values) to ${earthDataOutputDirPath}`,
    );
}

await main();
