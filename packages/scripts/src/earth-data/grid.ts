import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';

/** A row-major grid of numbers. */
export type Grid = {
    values: Float32Array;
    width: number;
    height: number;
};

function readValue(values: Readonly<ArrayLike<number>>, index: number) {
    return assertWrap.isDefined(values[index]);
}

/** Reverses the row order, such as to put a south-first grid's northernmost row first. */
export function flipGridRows({values, width, height}: Readonly<Grid>): Grid {
    const flipped = new Float32Array(values.length);
    flipped.forEach((value, index) => {
        const row = Math.floor(index / width);
        flipped[index] = readValue(values, (height - 1 - row) * width + (index % width));
    });
    return {
        values: flipped,
        width,
        height,
    };
}

/**
 * For resampling a line of `sourceCount` cells into `targetCount` cells that cover the same span:
 * which source cells each target cell overlaps, and how much of each.
 */
function createAreaWeights({
    sourceCount,
    targetCount,
}: Readonly<{
    sourceCount: number;
    targetCount: number;
}>) {
    const sourcePerTarget = sourceCount / targetCount;
    return createArray(targetCount, (targetIndex) => {
        const start = targetIndex * sourcePerTarget;
        const end = start + sourcePerTarget;
        const firstSource = Math.floor(start);
        const lastSource = Math.min(sourceCount - 1, Math.ceil(end) - 1);
        return createArray(lastSource - firstSource + 1, (offset) => {
            const sourceIndex = firstSource + offset;
            return {
                sourceIndex,
                weight:
                    (Math.min(end, sourceIndex + 1) - Math.max(start, sourceIndex)) /
                    sourcePerTarget,
            };
        });
    });
}

/**
 * Resamples a grid to a new size, with each new cell the area-weighted average of the old cells it
 * covers.
 */
export function resampleGridByArea({
    grid,
    width,
    height,
}: Readonly<{
    grid: Readonly<Grid>;
    width: number;
    height: number;
}>): Grid {
    const columnWeights = createAreaWeights({
        sourceCount: grid.width,
        targetCount: width,
    });
    const rowWeights = createAreaWeights({
        sourceCount: grid.height,
        targetCount: height,
    });
    /** Resampling columns first, then rows, keeps each pass a cheap one-dimensional average. */
    const columnsResampled = Float32Array.from(
        createArray(grid.height, (row) => row).flatMap((row) => {
            return columnWeights.map((weights) => {
                return weights.reduce((sum, {sourceIndex, weight}) => {
                    return sum + readValue(grid.values, row * grid.width + sourceIndex) * weight;
                }, 0);
            });
        }),
    );
    const resampled = Float32Array.from(
        rowWeights.flatMap((weights) => {
            return createArray(width, (column) => {
                return weights.reduce((sum, {sourceIndex, weight}) => {
                    return sum + readValue(columnsResampled, sourceIndex * width + column) * weight;
                }, 0);
            });
        }),
    );
    return {
        values: resampled,
        width,
        height,
    };
}

/** Rounds each value to the nearest whole number and writes them as little-endian `Int16`s. */
export function encodeInt16LittleEndian(values: Readonly<ArrayLike<number>>) {
    const bytes = Buffer.alloc(values.length * 2);
    Array.prototype.forEach.call(values, (value: number, index: number) => {
        bytes.writeInt16LE(Math.max(-32_768, Math.min(32_767, Math.round(value))), index * 2);
    });
    return bytes;
}

export function encodeFloat32LittleEndian(values: Readonly<ArrayLike<number>>) {
    const bytes = Buffer.alloc(values.length * 4);
    Array.prototype.forEach.call(values, (value: number, index: number) => {
        bytes.writeFloatLE(value, index * 4);
    });
    return bytes;
}
