// cspell:words bilinearly
import {assert, assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {wrapLongitudeDegrees} from './angles.js';

/**
 * A grid covering a whole sphere, laid out like the Earth data files: row 0 is the north, column 0
 * starts at 180°W, and each cell's values are stored together.
 */
export type EquirectangularGrid = {
    width: number;
    height: number;
    valuesPerCell: number;
    values: Readonly<ArrayLike<number>>;
};

/**
 * Bilinearly interpolates every value of a cell between the four nearest cell centers. Longitude
 * wraps around the date line, and latitudes beyond the outermost cell centers use the edge rows.
 */
export function sampleGrid({
    grid,
    latitudeDegrees,
    longitudeDegrees,
}: Readonly<{
    grid: Readonly<EquirectangularGrid>;
    latitudeDegrees: number;
    longitudeDegrees: number;
}>) {
    const column = ((wrapLongitudeDegrees(longitudeDegrees) + 180) / 360) * grid.width - 0.5;
    const row = Math.min(
        grid.height - 1,
        Math.max(0, ((90 - latitudeDegrees) / 180) * grid.height - 0.5),
    );
    const leftColumn = Math.floor(column);
    const topRow = Math.floor(row);
    const columnWeight = column - leftColumn;
    const rowWeight = row - topRow;
    const columns = [
        (leftColumn + grid.width) % grid.width,
        (leftColumn + 1) % grid.width,
    ] as const;
    const rows = [
        topRow,
        Math.min(grid.height - 1, topRow + 1),
    ] as const;

    function getValue({
        rowIndex,
        columnIndex,
        valueIndex,
    }: Readonly<{rowIndex: number; columnIndex: number; valueIndex: number}>) {
        return assertWrap.isDefined(
            grid.values[(rowIndex * grid.width + columnIndex) * grid.valuesPerCell + valueIndex],
        );
    }

    return createArray(grid.valuesPerCell, (valueIndex) => {
        const top =
            getValue({
                rowIndex: rows[0],
                columnIndex: columns[0],
                valueIndex,
            }) *
                (1 - columnWeight) +
            getValue({
                rowIndex: rows[0],
                columnIndex: columns[1],
                valueIndex,
            }) *
                columnWeight;
        const bottom =
            getValue({
                rowIndex: rows[1],
                columnIndex: columns[0],
                valueIndex,
            }) *
                (1 - columnWeight) +
            getValue({
                rowIndex: rows[1],
                columnIndex: columns[1],
                valueIndex,
            }) *
                columnWeight;
        return top * (1 - rowWeight) + bottom * rowWeight;
    });
}

/** {@link sampleGrid} for a grid with one value per cell. */
export function sampleGridValue(params: Parameters<typeof sampleGrid>[0]) {
    const values = sampleGrid(params);
    assert.isLengthExactly(values, 1);
    return values[0];
}
