import {log} from '@augment-vir/common';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {downloadsDirPath} from './file-paths.js';

export type DownloadSource = {
    /** Each source gets its own directory inside the downloads directory. */
    dirName: string;
    fileName: string;
    url: string;
};

/** Downloads a source file once, then reads it from the downloads directory on later runs. */
export async function download({dirName, fileName, url}: Readonly<DownloadSource>) {
    const filePath = join(downloadsDirPath, dirName, fileName);
    if (existsSync(filePath)) {
        return await readFile(filePath);
    }
    log.info(`Downloading ${url}`);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'cosmos-data-script/0.1',
        },
    });
    if (!response.ok) {
        throw new Error(`Download failed with ${response.status}: ${url}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(filePath), {
        recursive: true,
    });
    await writeFile(filePath, bytes);
    return bytes;
}
