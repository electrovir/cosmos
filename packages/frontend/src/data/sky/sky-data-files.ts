/** The sky data files that `@cosmos/scripts` builds into `www-static/sky/`. */
export const skyDataFileNames = {
    /**
     * Every star in the Yale Bright Star Catalog (5th edition) with a position, as little-endian
     * `Float32` values. Each star's {@link StarValue} values are stored together, in enum order.
     */
    stars: 'stars.bin',
} as const;

export const skyDataDirName = 'sky';

export enum StarValue {
    /** The J2000 equatorial (ICRF) direction to the star, as a unit vector with z toward north. */
    X = 'x',
    Y = 'y',
    Z = 'z',
    /** Apparent brightness in the V band. Smaller is brighter. */
    VisualMagnitude = 'visual-magnitude',
    /** B−V color index. Blue stars are negative, red stars above 1. */
    ColorIndex = 'color-index',
}

export const starValueOrder = Object.values(StarValue);
