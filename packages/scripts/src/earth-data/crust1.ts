// cspell:words bnds
import {assertWrap} from '@augment-vir/assert';
import {
    CrustBoundary,
    crustBoundaryOrder,
    earthCrustGridSize,
} from '@cosmos/frontend/src/data/earth/earth-data-files.js';

/** Each boundary's column in a `crust1.bnds` line, counting from 0. */
const crust1BoundaryColumns: Record<CrustBoundary, number> = {
    [CrustBoundary.WaterBottom]: 1,
    [CrustBoundary.IceBottom]: 2,
    /** Columns 3 and 4 are the bottoms of the upper and middle sediment layers. */
    [CrustBoundary.SedimentBottom]: 5,
    [CrustBoundary.UpperCrustBottom]: 6,
    [CrustBoundary.MiddleCrustBottom]: 7,
    [CrustBoundary.Moho]: 8,
};

const crust1ColumnCount = 9;

/**
 * Converts CRUST1.0's `crust1.bnds` text (one line per cell, nine boundary elevations in km) into
 * the `crust.bin` layout: each cell's {@link CrustBoundary} values in meters, in enum order. Both
 * use the same cell order: rows from north to south, columns from west to east.
 */
export function convertCrust1Boundaries(boundariesText: string) {
    const lines = boundariesText.split('\n').filter((line) => line.trim());
    const cellCount = earthCrustGridSize.width * earthCrustGridSize.height;
    if (lines.length !== cellCount) {
        throw new Error(`Expected ${cellCount} CRUST1.0 cells but got ${lines.length}.`);
    }
    const output = new Float32Array(cellCount * crustBoundaryOrder.length);
    lines.forEach((line, cellIndex) => {
        const values = line.trim().split(/\s+/).map(Number);
        if (values.length !== crust1ColumnCount || values.some((value) => Number.isNaN(value))) {
            throw new Error(`Invalid CRUST1.0 line ${cellIndex + 1}: '${line}'`);
        }
        crustBoundaryOrder.forEach((boundary, boundaryIndex) => {
            output[cellIndex * crustBoundaryOrder.length + boundaryIndex] =
                assertWrap.isDefined(values[crust1BoundaryColumns[boundary]]) * 1000;
        });
    });
    return output;
}
