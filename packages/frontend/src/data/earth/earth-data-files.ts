// cspell:words mohorovičić
/**
 * The Earth data files that `@cosmos/scripts` builds into `www-static/earth/`. Every grid is
 * equirectangular: row 0 is the northernmost row, column 0 the westernmost (starting at 180°W), and
 * each value is the average over its cell.
 */
export const earthDataFileNames = {
    /** NASA Blue Marble (with ocean floor shading) as a JPEG. */
    surfaceColor: 'surface-color.jpg',
    /** The same image, small enough to load for Earth seen from afar. */
    surfaceColorSmall: 'surface-color-small.jpg',
    /**
     * NOAA ETOPO 2022 surface elevation (the top of ice sheets, not the rock below them) in whole
     * meters relative to sea level, as little-endian `Int16` values.
     */
    elevation: 'elevation.bin',
    /**
     * CRUST1.0 layer boundaries in meters relative to sea level, as little-endian `Float32` values.
     * Each cell's {@link CrustBoundary} values are stored together, in enum order.
     */
    crust: 'crust.bin',
} as const;

export const earthDataDirName = 'earth';

export const earthSurfaceColorSize = {
    width: 4096,
    height: 2048,
} as const;

export const earthSurfaceColorSmallSize = {
    width: 1024,
    height: 512,
} as const;

export const earthElevationGridSize = {
    width: 2048,
    height: 1024,
} as const;

export const earthCrustGridSize = {
    width: 360,
    height: 180,
} as const;

/**
 * The bottoms of the crust layers CRUST1.0 models, from the top down. Within a cell these never
 * increase. A layer that is missing from a cell has the same bottom as the layer above it.
 */
export enum CrustBoundary {
    /** The ocean floor, or the land surface where there is no ocean. Includes the ice on top. */
    WaterBottom = 'water-bottom',
    IceBottom = 'ice-bottom',
    SedimentBottom = 'sediment-bottom',
    UpperCrustBottom = 'upper-crust-bottom',
    MiddleCrustBottom = 'middle-crust-bottom',
    /** The bottom of the lower crust: the Mohorovičić discontinuity, where the mantle starts. */
    Moho = 'moho',
}

export const crustBoundaryOrder = Object.values(CrustBoundary);
