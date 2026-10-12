// cspell:words lroc mozjpeg
import {log} from '@augment-vir/common';
import {
    moonDataFileNames,
    moonSurfaceColorSize,
    moonSurfaceColorSmallSize,
} from '@cosmos/frontend/src/data/moon/moon-data-files.js';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {download} from './download.js';
import {moonDataOutputDirPath} from './file-paths.js';

const moonKitColor = {
    dirName: 'cgi-moon-kit',
    fileName: 'lroc_color_poles_4k.tif',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif',
};

async function main() {
    await mkdir(moonDataOutputDirPath, {
        recursive: true,
    });
    const sourceBytes = await download(moonKitColor);
    await Promise.all(
        [
            {
                size: moonSurfaceColorSize,
                fileName: moonDataFileNames.surfaceColor,
            },
            {
                size: moonSurfaceColorSmallSize,
                fileName: moonDataFileNames.surfaceColorSmall,
            },
        ].map(async ({size, fileName}) => {
            await sharp(sourceBytes)
                .resize(size.width, size.height)
                .jpeg({
                    quality: 85,
                    mozjpeg: true,
                })
                .toFile(join(moonDataOutputDirPath, fileName));
        }),
    );
    log.success(`Wrote ${Object.values(moonDataFileNames).join(', ')} to ${moonDataOutputDirPath}`);
}

await main();
