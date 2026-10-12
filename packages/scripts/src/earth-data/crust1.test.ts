import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    crustBoundaryOrder,
    earthCrustGridSize,
} from '@cosmos/frontend/src/data/earth/earth-data-files.js';
import {convertCrust1Boundaries} from './crust1.js';

const cellCount = earthCrustGridSize.width * earthCrustGridSize.height;
const oceanLine = '   0.00  -3.69  -3.69  -4.99  -4.99  -4.99  -5.67  -7.15 -11.75';

describe(convertCrust1Boundaries.name, () => {
    it('keeps the modeled boundaries in meters, in enum order', () => {
        const output = convertCrust1Boundaries(
            [
                '   4.92   4.92   4.92   4.82   4.82   4.82 -31.23 -48.54 -67.28',
                ...createArray(cellCount - 1, () => oceanLine),
                '',
            ].join('\n'),
        );
        assert.deepEquals(
            [
                Array.from(output.subarray(0, crustBoundaryOrder.length)).map(Math.round),
                Array.from(output.subarray(-crustBoundaryOrder.length)).map(Math.round),
            ],
            [
                [
                    4920,
                    4920,
                    4820,
                    -31_230,
                    -48_540,
                    -67_280,
                ],
                [
                    -3690,
                    -3690,
                    -4990,
                    -5670,
                    -7150,
                    -11_750,
                ],
            ],
        );
    });
    it('rejects the wrong number of cells', () => {
        assert.throws(() => convertCrust1Boundaries(oceanLine), {
            matchMessage: 'Expected',
        });
    });
    it('rejects a malformed line', () => {
        assert.throws(
            () => {
                return convertCrust1Boundaries(
                    [
                        '1 2 3',
                        ...createArray(cellCount - 1, () => oceanLine),
                    ].join('\n'),
                );
            },
            {
                matchMessage: 'Invalid',
            },
        );
    });
});
