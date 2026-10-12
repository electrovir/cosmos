import {log} from '@augment-vir/common';
import {
    skyDataFileNames,
    StarValue,
    starValueOrder,
} from '@cosmos/frontend/src/data/sky/sky-data-files.js';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {download} from './download.js';
import {encodeFloat32LittleEndian} from './earth-data/grid.js';
import {skyDataOutputDirPath} from './file-paths.js';
import {parseBrightStarCatalog} from './sky-data/bright-star-catalog.js';

async function main() {
    const stars = parseBrightStarCatalog(
        gunzipSync(
            await download({
                dirName: 'bright-star-catalog',
                fileName: 'catalog.gz',
                url: 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz',
            }),
        ).toString('latin1'),
    );
    const values = stars.flatMap(
        ({rightAscensionDegrees, declinationDegrees, visualMagnitude, colorIndex}) => {
            const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
            const declination = (declinationDegrees * Math.PI) / 180;
            const starValues: Record<StarValue, number> = {
                [StarValue.X]: Math.cos(declination) * Math.cos(rightAscension),
                [StarValue.Y]: Math.cos(declination) * Math.sin(rightAscension),
                [StarValue.Z]: Math.sin(declination),
                [StarValue.VisualMagnitude]: visualMagnitude,
                [StarValue.ColorIndex]: colorIndex,
            };
            return starValueOrder.map((key) => starValues[key]);
        },
    );
    await mkdir(skyDataOutputDirPath, {
        recursive: true,
    });
    await writeFile(
        join(skyDataOutputDirPath, skyDataFileNames.stars),
        encodeFloat32LittleEndian(values),
    );
    log.success(`Wrote ${stars.length} stars to ${skyDataOutputDirPath}`);
}

await main();
