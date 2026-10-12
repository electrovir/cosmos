import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {type EquirectangularGrid, sampleGrid, sampleGridValue} from './equirectangular-grid.js';

/** Four columns 90° wide and two rows: north cells hold 0..3, south cells hold 10..13. */
const grid: EquirectangularGrid = {
    width: 4,
    height: 2,
    valuesPerCell: 1,
    values: [
        0,
        1,
        2,
        3,
        10,
        11,
        12,
        13,
    ],
};

describe(sampleGridValue.name, () => {
    it('returns a cell center exactly', () => {
        assert.strictEquals(
            sampleGridValue({
                grid,
                latitudeDegrees: 45,
                longitudeDegrees: -135,
            }),
            0,
        );
    });
    it('blends across the date line', () => {
        assert.strictEquals(
            sampleGridValue({
                grid,
                latitudeDegrees: 45,
                longitudeDegrees: 180,
            }),
            1.5,
        );
    });
    it('blends between rows and clamps past the edge rows', () => {
        assert.deepEquals(
            [
                0,
                90,
                -90,
            ].map((latitudeDegrees) => {
                return sampleGridValue({
                    grid,
                    latitudeDegrees,
                    longitudeDegrees: -45,
                });
            }),
            [
                6,
                1,
                11,
            ],
        );
    });
    it('rejects a grid with several values per cell', () => {
        assert.throws(() => {
            return sampleGridValue({
                grid: {
                    ...grid,
                    width: 2,
                    valuesPerCell: 2,
                },
                latitudeDegrees: 0,
                longitudeDegrees: 0,
            });
        });
    });
});

describe(sampleGrid.name, () => {
    it('samples every value of a cell', () => {
        assert.deepEquals(
            sampleGrid({
                grid: {
                    width: 1,
                    height: 1,
                    valuesPerCell: 2,
                    values: [
                        5,
                        7,
                    ],
                },
                latitudeDegrees: 10,
                longitudeDegrees: 20,
            }),
            [
                5,
                7,
            ],
        );
    });
});
