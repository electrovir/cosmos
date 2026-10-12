import {assertWrap} from '@augment-vir/assert';
import {arrayToObject} from '@augment-vir/common';
import {
    crustBoundaryOrder,
    earthCrustGridSize,
    earthElevationGridSize,
} from '../data/earth/earth-data-files.js';
import {type EquirectangularGrid, sampleGrid, sampleGridValue} from './equirectangular-grid.js';

export type SurfaceData = {
    /** Meters relative to sea level. */
    elevation: Readonly<EquirectangularGrid>;
    /** Each cell's crust boundaries in meters relative to sea level, in `crustBoundaryOrder`. */
    crust: Readonly<EquirectangularGrid>;
};

/**
 * Reads the bytes of Earth's `elevation.bin` and `crust.bin` files. The typed arrays read the
 * platform's byte order, which is little-endian on every platform browsers run on.
 */
export function parseEarthSurfaceData({
    elevationBytes,
    crustBytes,
}: Readonly<{
    elevationBytes: ArrayBuffer;
    crustBytes: ArrayBuffer;
}>) {
    const elevation = new Int16Array(elevationBytes);
    const crust = new Float32Array(crustBytes);
    const expectedElevationCount = earthElevationGridSize.width * earthElevationGridSize.height;
    const expectedCrustCount =
        earthCrustGridSize.width * earthCrustGridSize.height * crustBoundaryOrder.length;
    if (elevation.length !== expectedElevationCount || crust.length !== expectedCrustCount) {
        throw new Error(
            `Earth surface data has ${elevation.length} elevations and ${crust.length} crust values but needs ${expectedElevationCount} and ${expectedCrustCount}. Run 'npm run build:data'.`,
        );
    }
    return {
        elevation: {
            ...earthElevationGridSize,
            valuesPerCell: 1,
            values: elevation,
        },
        crust: {
            ...earthCrustGridSize,
            valuesPerCell: crustBoundaryOrder.length,
            values: crust,
        },
    };
}

export function sampleSurface({
    data,
    latitudeDegrees,
    longitudeDegrees,
}: Readonly<{
    data: Readonly<SurfaceData>;
    latitudeDegrees: number;
    longitudeDegrees: number;
}>) {
    const crustMeters = sampleGrid({
        grid: data.crust,
        latitudeDegrees,
        longitudeDegrees,
    });
    return {
        elevationKm:
            sampleGridValue({
                grid: data.elevation,
                latitudeDegrees,
                longitudeDegrees,
            }) / 1000,
        crustBoundariesKm: arrayToObject(
            crustBoundaryOrder,
            (boundary, index) => {
                return {
                    key: boundary,
                    value: assertWrap.isDefined(crustMeters[index]) / 1000,
                };
            },
            {
                useRequired: true,
            },
        ),
    };
}
