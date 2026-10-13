import {Vector3} from 'three';
import {degreesToRadians} from './angles.js';

export const moonRadiusKm = 1737.4;
/** One trip around Earth against the stars. */
export const moonSiderealPeriodDays = 27.321661;
/** The Moon's average distance from Earth. */
export const moonSemiMajorAxisKm = 384_399;

/** Earth's equatorial radius, which the Moon's distance is measured in by its parallax. */
const earthEquatorialRadiusKm = 6378.14;
/** How far the equinox drifts each Julian century, which turns longitudes of date into J2000. */
const precessionDegreesPerCentury = 1.397;

/** Sums `amplitude * wave(phase + rate * centuries)` terms, with angles in degrees. */
function sumTerms({
    terms,
    centuries,
    wave,
}: Readonly<{
    terms: ReadonlyArray<
        Readonly<{
            amplitude: number;
            phase: number;
            rate: number;
        }>
    >;
    centuries: number;
    wave: (radians: number) => number;
}>) {
    return terms.reduce((sum, {amplitude, phase, rate}) => {
        return sum + amplitude * wave(degreesToRadians(phase + rate * centuries));
    }, 0);
}

/**
 * The Moon's position relative to Earth's center, in kilometers, in the J2000 ecliptic frame (the
 * same frame as `getOrbitPosition`). Uses the Astronomical Almanac's low-precision formula, good to
 * a few tenths of a degree: plenty for drawing, not for predicting eclipses.
 */
export function getMoonPosition(daysSinceJ2000: number) {
    const centuries = daysSinceJ2000 / 36_525;
    const longitudeDegrees =
        218.32 +
        481_267.881 * centuries +
        sumTerms({
            centuries,
            wave: Math.sin,
            terms: [
                {
                    amplitude: 6.29,
                    phase: 135,
                    rate: 477_198.87,
                },
                {
                    amplitude: -1.27,
                    phase: 259.3,
                    rate: -413_335.36,
                },
                {
                    amplitude: 0.66,
                    phase: 235.7,
                    rate: 890_534.22,
                },
                {
                    amplitude: 0.21,
                    phase: 269.9,
                    rate: 954_397.74,
                },
                {
                    amplitude: -0.19,
                    phase: 357.5,
                    rate: 35_999.05,
                },
                {
                    amplitude: -0.11,
                    phase: 186.5,
                    rate: 966_404.03,
                },
            ],
        }) -
        precessionDegreesPerCentury * centuries;
    const latitudeDegrees = sumTerms({
        centuries,
        wave: Math.sin,
        terms: [
            {
                amplitude: 5.13,
                phase: 93.3,
                rate: 483_202.02,
            },
            {
                amplitude: 0.28,
                phase: 228.2,
                rate: 960_400.89,
            },
            {
                amplitude: -0.28,
                phase: 318.3,
                rate: 6003.15,
            },
            {
                amplitude: -0.17,
                phase: 217.6,
                rate: -407_332.21,
            },
        ],
    });
    const parallaxDegrees =
        0.9508 +
        sumTerms({
            centuries,
            wave: Math.cos,
            terms: [
                {
                    amplitude: 0.0518,
                    phase: 135,
                    rate: 477_198.87,
                },
                {
                    amplitude: 0.0095,
                    phase: 259.3,
                    rate: -413_335.36,
                },
                {
                    amplitude: 0.0078,
                    phase: 235.7,
                    rate: 890_534.22,
                },
                {
                    amplitude: 0.0028,
                    phase: 269.9,
                    rate: 954_397.74,
                },
            ],
        });
    const distanceKm = earthEquatorialRadiusKm / Math.sin(degreesToRadians(parallaxDegrees));
    const longitude = degreesToRadians(longitudeDegrees);
    const latitude = degreesToRadians(latitudeDegrees);
    return new Vector3(
        Math.cos(latitude) * Math.cos(longitude),
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
    ).multiplyScalar(distanceKm);
}
