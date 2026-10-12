import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {
    encodeFloat32LittleEndian,
    encodeInt16LittleEndian,
    flipGridRows,
    resampleGridByArea,
} from './grid.js';

describe(flipGridRows.name, () => {
    it('reverses the rows but not the columns', () => {
        assert.deepEquals(
            Array.from(
                flipGridRows({
                    values: new Float32Array([
                        1,
                        2,
                        3,
                        4,
                        5,
                        6,
                    ]),
                    width: 2,
                    height: 3,
                }).values,
            ),
            [
                5,
                6,
                3,
                4,
                1,
                2,
            ],
        );
    });
});

describe(resampleGridByArea.name, () => {
    it('averages whole blocks when shrinking by a whole factor', () => {
        assert.deepEquals(
            Array.from(
                resampleGridByArea({
                    grid: {
                        values: new Float32Array([
                            1,
                            3,
                            10,
                            20,
                            5,
                            7,
                            30,
                            40,
                        ]),
                        width: 4,
                        height: 2,
                    },
                    width: 2,
                    height: 1,
                }).values,
            ),
            [
                4,
                25,
            ],
        );
    });
    it('weights cells by how much of them each new cell covers', () => {
        assert.deepEquals(
            Array.from(
                resampleGridByArea({
                    grid: {
                        values: new Float32Array([
                            0,
                            3,
                            6,
                        ]),
                        width: 3,
                        height: 1,
                    },
                    width: 2,
                    height: 1,
                }).values,
            ),
            [
                1,
                5,
            ],
        );
    });
});

describe(encodeInt16LittleEndian.name, () => {
    it('rounds and clamps to the Int16 range', () => {
        assert.deepEquals(
            Array.from(
                new Int16Array(
                    new Uint8Array(
                        encodeInt16LittleEndian([
                            1.6,
                            -2.4,
                            40_000,
                            -40_000,
                        ]),
                    ).buffer,
                ),
            ),
            [
                2,
                -2,
                32_767,
                -32_768,
            ],
        );
    });
});

describe(encodeFloat32LittleEndian.name, () => {
    it('writes each value as 4 little-endian bytes', () => {
        const bytes = encodeFloat32LittleEndian([
            1.5,
            -2,
        ]);
        assert.deepEquals(
            [
                bytes.readFloatLE(0),
                bytes.readFloatLE(4),
            ],
            [
                1.5,
                -2,
            ],
        );
    });
});
