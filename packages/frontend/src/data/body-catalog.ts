import {moonRadiusKm} from '../physics/moon-position.js';
import {BodyId, BodyKind, type BodyDetails, type BodySummary} from './celestial-body.js';

export const kilometersPerAstronomicalUnit = 149_597_870.7;

/**
 * Every body the app knows about. Orbits are the J2000 elements from Standish's "Keplerian Elements
 * for Approximate Positions of the Major Planets" (Earth's is the Earth-Moon barycenter's).
 * Rotations are from the IAU WGCCRE 2009 report, without the slow drift of the pole.
 */
export const bodyCatalog: Readonly<Record<BodyId, Readonly<BodySummary>>> = {
    [BodyId.Sun]: {
        id: BodyId.Sun,
        name: 'Sun',
        kind: BodyKind.Star,
        radiusKm: 695_700,
        rotation: {
            poleRightAscensionDegrees: 286.13,
            poleDeclinationDegrees: 63.87,
            primeMeridianAtJ2000Degrees: 84.176,
            primeMeridianDegreesPerDay: 14.1844,
        },
    },
    [BodyId.Earth]: {
        id: BodyId.Earth,
        name: 'Earth',
        kind: BodyKind.Planet,
        radiusKm: 6371,
        parentId: BodyId.Sun,
        orbit: {
            semiMajorAxisKm: 1.00000261 * kilometersPerAstronomicalUnit,
            eccentricity: 0.01671123,
            inclinationDegrees: -0.00001531,
            meanLongitudeAtJ2000Degrees: 100.46457166,
            longitudeOfPerihelionDegrees: 102.93768193,
            longitudeOfAscendingNodeDegrees: 0,
            periodDays: 365.256363,
        },
        rotation: {
            poleRightAscensionDegrees: 0,
            poleDeclinationDegrees: 90,
            primeMeridianAtJ2000Degrees: 190.147,
            primeMeridianDegreesPerDay: 360.9856235,
        },
    },
    /** Its orbit comes from `getMoonPosition` instead of fixed elements, which drift too fast. */
    [BodyId.Moon]: {
        id: BodyId.Moon,
        name: 'Moon',
        kind: BodyKind.Moon,
        radiusKm: moonRadiusKm,
        parentId: BodyId.Earth,
        rotation: {
            poleRightAscensionDegrees: 269.9949,
            poleDeclinationDegrees: 66.5392,
            primeMeridianAtJ2000Degrees: 38.3213,
            primeMeridianDegreesPerDay: 13.17635815,
        },
    },
};

/** Each body's details file, loaded only when the body is shown up close. */
export async function loadBodyDetails(bodyId: BodyId): Promise<Readonly<BodyDetails>> {
    return (await import(`./bodies/${bodyId}.body.ts`)).default;
}
