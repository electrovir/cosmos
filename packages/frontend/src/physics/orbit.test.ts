import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {bodyCatalog, kilometersPerAstronomicalUnit} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {getDaysSinceJ2000, getOrbitPosition, solveEccentricAnomaly} from './orbit.js';

describe(getDaysSinceJ2000.name, () => {
    it('is zero at the J2000 epoch', () => {
        assert.strictEquals(getDaysSinceJ2000(Date.UTC(2000, 0, 1, 11, 58, 55, 816)), 0);
    });
    it('counts whole days', () => {
        assert.strictEquals(getDaysSinceJ2000(Date.UTC(2000, 0, 2, 11, 58, 55, 816)), 1);
    });
});

describe(solveEccentricAnomaly.name, () => {
    it('satisfies Kepler’s equation', () => {
        const eccentricity = 0.2;
        const meanAnomalyRadians = 1.3;
        const eccentricAnomaly = solveEccentricAnomaly({
            meanAnomalyRadians,
            eccentricity,
        });
        assert.isApproximately(
            eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly),
            meanAnomalyRadians,
            1e-10,
        );
    });
    it('returns the mean anomaly for a circle', () => {
        assert.strictEquals(
            solveEccentricAnomaly({
                meanAnomalyRadians: 2,
                eccentricity: 0,
            }),
            2,
        );
    });
});

describe(getOrbitPosition.name, () => {
    const earthOrbit = assertWrap.isDefined(bodyCatalog[BodyId.Earth].orbit);

    it('puts Earth opposite the Sun’s ecliptic longitude at J2000', () => {
        const position = getOrbitPosition({
            orbit: earthOrbit,
            daysSinceJ2000: 0,
        });
        /** The Sun's apparent ecliptic longitude was about 280.4° then. */
        const earthLongitudeDegrees = (Math.atan2(position.y, position.x) * 180) / Math.PI;
        assert.isApproximately(earthLongitudeDegrees, 100.4, 0.3);
        assert.isApproximately(position.length() / kilometersPerAstronomicalUnit, 0.9833, 0.001);
    });
    it('is farthest from the Sun in early July', () => {
        const aphelion = getOrbitPosition({
            orbit: earthOrbit,
            daysSinceJ2000: getDaysSinceJ2000(Date.UTC(2000, 6, 4)),
        });
        assert.isApproximately(aphelion.length() / kilometersPerAstronomicalUnit, 1.0167, 0.001);
    });
});
