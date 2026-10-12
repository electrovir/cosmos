/**
 * The Moon data files that `@cosmos/scripts` builds into `www-static/moon/`. Every image is
 * equirectangular: the top row is the north pole and the left edge is 180°W.
 */
export const moonDataFileNames = {
    /** NASA's CGI Moon Kit color map, from Lunar Reconnaissance Orbiter camera mosaics, as a JPEG. */
    surfaceColor: 'surface-color.jpg',
    /** The same image, small enough to load for the Moon seen from afar. */
    surfaceColorSmall: 'surface-color-small.jpg',
} as const;

export const moonDataDirName = 'moon';

export const moonSurfaceColorSize = {
    width: 4096,
    height: 2048,
} as const;

export const moonSurfaceColorSmallSize = {
    width: 1024,
    height: 512,
} as const;
