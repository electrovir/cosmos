import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {type AddressInfo} from 'node:net';
import {join} from 'node:path';
import {download} from './download.js';
import {downloadsDirPath} from './file-paths.js';

describe(download.name, () => {
    it('downloads once, reads the saved file after, and rejects failed responses', async () => {
        const server = createServer((request, response) => {
            response.statusCode = request.url === '/file.txt' ? 200 : 404;
            response.end('star data');
        });
        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const dirName = 'download-test';
        try {
            const source = {
                dirName,
                fileName: 'file.txt',
                url: `${baseUrl}/file.txt`,
            };
            assert.strictEquals((await download(source)).toString(), 'star data');
            await assert.throws(
                download({
                    ...source,
                    fileName: 'missing.txt',
                    url: `${baseUrl}/missing.txt`,
                }),
            );
            server.close();
            assert.strictEquals((await download(source)).toString(), 'star data');
        } finally {
            server.close();
            await rm(join(downloadsDirPath, dirName), {
                recursive: true,
                force: true,
            });
        }
    });
});
