import {type BodyId} from '../celestial-body.js';

/**
 * Bodies whose only data files are surface images. Deimos and Uranus' moons are left out since no
 * public domain map covers them.
 */
export type SurfaceMapBodyId = Exclude<
    BodyId,
    | BodyId.Sun
    | BodyId.Earth
    | BodyId.Moon
    | BodyId.Deimos
    | BodyId.Miranda
    | BodyId.Ariel
    | BodyId.Umbriel
    | BodyId.Titania
    | BodyId.Oberon
>;

/**
 * The surface images that `@cosmos/scripts` builds into `www-static/<body id>/` for each
 * {@link SurfaceMapBodyId}. Every image is equirectangular: the top row is the north pole and the
 * left edge is 180°W.
 */
export const surfaceMapFileNames = {
    surfaceColor: 'surface-color.jpg',
    /** The same image, small enough to load for the body seen from afar. */
    surfaceColorSmall: 'surface-color-small.jpg',
} as const;

export const surfaceMapSize = {
    width: 2048,
    height: 1024,
} as const;

export const surfaceMapSmallSize = {
    width: 1024,
    height: 512,
} as const;
