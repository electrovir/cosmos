import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {extractTarFile} from './tar.js';

function createTarEntry({
    name,
    prefix,
    contents,
}: Readonly<{
    name: string;
    prefix?: string | undefined;
    contents: string;
}>) {
    const header = Buffer.alloc(512);
    header.write(name, 0);
    header.write(`${contents.length.toString(8).padStart(11, '0')}\0`, 124);
    if (prefix) {
        header.write(prefix, 345);
    }
    const data = Buffer.alloc(Math.ceil(contents.length / 512) * 512);
    data.write(contents);
    return Buffer.concat([
        header,
        data,
    ]);
}

const tarBytes = new Uint8Array(
    Buffer.concat([
        createTarEntry({
            name: 'readme',
            contents: 'x'.repeat(600),
        }),
        createTarEntry({
            name: 'model.txt',
            prefix: 'nested',
            contents: 'nested model',
        }),
        createTarEntry({
            name: 'model.txt',
            contents: 'top model',
        }),
        createTarEntry({
            name: 'n'.repeat(100),
            contents: 'full-length name',
        }),
        Buffer.alloc(1024),
    ]),
);

describe(extractTarFile.name, () => {
    it('finds a file after a multi-block entry', () => {
        assert.strictEquals(
            Buffer.from(
                assertWrap.isDefined(
                    extractTarFile({
                        tarBytes,
                        filePath: 'model.txt',
                    }),
                ),
            ).toString(),
            'top model',
        );
    });
    it('matches paths that include the header prefix', () => {
        assert.strictEquals(
            Buffer.from(
                assertWrap.isDefined(
                    extractTarFile({
                        tarBytes,
                        filePath: 'nested/model.txt',
                    }),
                ),
            ).toString(),
            'nested model',
        );
    });
    it('reads a name that fills its whole header field', () => {
        assert.strictEquals(
            Buffer.from(
                assertWrap.isDefined(
                    extractTarFile({
                        tarBytes,
                        filePath: 'n'.repeat(100),
                    }),
                ),
            ).toString(),
            'full-length name',
        );
    });
    it('returns undefined for a missing file', () => {
        assert.isUndefined(
            extractTarFile({
                tarBytes,
                filePath: 'missing',
            }),
        );
    });
    it('stops at the end of an archive without end blocks', () => {
        assert.isUndefined(
            extractTarFile({
                tarBytes: tarBytes.subarray(0, 1024 + 512),
                filePath: 'missing',
            }),
        );
    });
});
