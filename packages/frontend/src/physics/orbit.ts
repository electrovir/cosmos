import {Vector3} from 'three';
import {type OrbitElements} from '../data/celestial-body.js';
import {degreesToRadians} from './angles.js';

/** 2000-01-01 12:00 Terrestrial Time, which is 64.184 seconds ahead of UTC then. */
const j2000Milliseconds = Date.UTC(2000, 0, 1, 11, 58, 55, 816);
const millisecondsPerDay = 86_400_000;

export function getDaysSinceJ2000(unixMilliseconds: number) {
    return (unixMilliseconds - j2000Milliseconds) / millisecondsPerDay;
}

/** Solves Kepler's equation `M = E - e sin(E)` for the eccentric anomaly `E`, in radians. */
export function solveEccentricAnomaly({
    meanAnomalyRadians,
    eccentricity,
}: Readonly<{
    meanAnomalyRadians: number;
    eccentricity: number;
}>) {
    /**
     * Newton's method converges in a few steps for the near-circular orbits of planets. The return
     * type annotation is required because the function is recursive.
     */
    function iterate({
        eccentricAnomaly,
        stepsLeft,
    }: Readonly<{eccentricAnomaly: number; stepsLeft: number}>): number {
        const next =
            eccentricAnomaly -
            (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomalyRadians) /
                (1 - eccentricity * Math.cos(eccentricAnomaly));
        return stepsLeft && Math.abs(next - eccentricAnomaly) > 1e-12
            ? iterate({
                  eccentricAnomaly: next,
                  stepsLeft: stepsLeft - 1,
              })
            : next;
    }
    return iterate({
        eccentricAnomaly: meanAnomalyRadians + eccentricity * Math.sin(meanAnomalyRadians),
        stepsLeft: 20,
    });
}

/**
 * The body's position relative to its parent, in kilometers, in the J2000 ecliptic frame: x toward
 * the March equinox, z toward the ecliptic's north.
 */
export function getOrbitPosition({
    orbit,
    daysSinceJ2000,
}: Readonly<{
    orbit: Readonly<OrbitElements>;
    daysSinceJ2000: number;
}>) {
    const perihelionArgument = degreesToRadians(
        orbit.longitudeOfPerihelionDegrees - orbit.longitudeOfAscendingNodeDegrees,
    );
    const node = degreesToRadians(orbit.longitudeOfAscendingNodeDegrees);
    const inclination = degreesToRadians(orbit.inclinationDegrees);
    const eccentricAnomaly = solveEccentricAnomaly({
        meanAnomalyRadians: degreesToRadians(
            orbit.meanLongitudeAtJ2000Degrees -
                orbit.longitudeOfPerihelionDegrees +
                (360 / orbit.periodDays) * daysSinceJ2000,
        ),
        eccentricity: orbit.eccentricity,
    });
    const inPlaneX = orbit.semiMajorAxisKm * (Math.cos(eccentricAnomaly) - orbit.eccentricity);
    const inPlaneY =
        orbit.semiMajorAxisKm * Math.sqrt(1 - orbit.eccentricity ** 2) * Math.sin(eccentricAnomaly);

    return new Vector3(inPlaneX, inPlaneY, 0)
        .applyAxisAngle(new Vector3(0, 0, 1), perihelionArgument)
        .applyAxisAngle(new Vector3(1, 0, 0), inclination)
        .applyAxisAngle(new Vector3(0, 0, 1), node);
}
