// cspell:words opendap
import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {parseDap2Float32Array} from './opendap.js';

function createDap2Response({
    counts,
    values,
}: Readonly<{
    counts: Readonly<
        [
            number,
            number,
        ]
    >;
    values: ReadonlyArray<number>;
}>) {
    const data = Buffer.alloc(8 + values.length * 4);
    data.writeUInt32BE(counts[0], 0);
    data.writeUInt32BE(counts[1], 4);
    values.forEach((value, index) => {
        data.writeFloatBE(value, 8 + index * 4);
    });
    return new Uint8Array(
        Buffer.concat([
            Buffer.from('Dataset {\n    Float32 z[lat = 1][lon = 2];\n} z;\n\nData:\n'),
            data,
        ]),
    );
}

describe(parseDap2Float32Array.name, () => {
    it('reads the big-endian values after the data marker', () => {
        assert.deepEquals(
            Array.from(
                parseDap2Float32Array(
                    createDap2Response({
                        counts: [
                            2,
                            2,
                        ],
                        values: [
                            -1.5,
                            8000,
                        ],
                    }),
                ),
            ),
            [
                -1.5,
                8000,
            ],
        );
    });
    it('rejects a response without data', () => {
        assert.throws(() => parseDap2Float32Array(new Uint8Array(Buffer.from('Error {}'))), {
            matchMessage: 'no',
        });
    });
    it('rejects disagreeing lengths', () => {
        assert.throws(
            () => {
                return parseDap2Float32Array(
                    createDap2Response({
                        counts: [
                            2,
                            3,
                        ],
                        values: [
                            1,
                            2,
                        ],
                    }),
                );
            },
            {
                matchMessage: 'disagree',
            },
        );
    });
    it('rejects a truncated response', () => {
        assert.throws(
            () => {
                return parseDap2Float32Array(
                    createDap2Response({
                        counts: [
                            3,
                            3,
                        ],
                        values: [
                            1,
                            2,
                        ],
                    }),
                );
            },
            {
                matchMessage: 'truncated',
            },
        );
    });
});
