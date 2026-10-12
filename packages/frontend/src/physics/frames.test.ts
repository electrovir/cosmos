import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {Vector3} from 'three';
import {bodyCatalog} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {
    astronomyToScene,
    directionToLatitudeLongitude,
    equatorialToEcliptic,
    getBodyOrientation,
    latitudeLongitudeToDirection,
} from './frames.js';
import {getDaysSinceJ2000, getOrbitPosition} from './orbit.js';

describe(latitudeLongitudeToDirection.name, () => {
    it('puts the north pole at +y and east at -z', () => {
        assert.isTrue(
            latitudeLongitudeToDirection({
                latitudeDegrees: 90,
                longitudeDegrees: 0,
            }).distanceTo(new Vector3(0, 1, 0)) < 1e-12,
        );
        assert.isTrue(
            latitudeLongitudeToDirection({
                latitudeDegrees: 0,
                longitudeDegrees: 90,
            }).distanceTo(new Vector3(0, 0, -1)) < 1e-12,
        );
    });
    it('round trips', () => {
        const result = directionToLatitudeLongitude(
            latitudeLongitudeToDirection({
                latitudeDegrees: -33,
                longitudeDegrees: 151,
            }).multiplyScalar(5),
        );
        assert.isApproximately(result.latitudeDegrees, -33, 1e-9);
        assert.isApproximately(result.longitudeDegrees, 151, 1e-9);
    });
});

describe(equatorialToEcliptic.name, () => {
    it('tilts the celestial north pole away from the ecliptic pole', () => {
        const pole = astronomyToScene(equatorialToEcliptic(new Vector3(0, 0, 1)));
        assert.isApproximately((Math.acos(pole.y) * 180) / Math.PI, 23.44, 0.01);
    });
});

describe(getBodyOrientation.name, () => {
    function getSubsolarPoint(unixMilliseconds: number) {
        const daysSinceJ2000 = getDaysSinceJ2000(unixMilliseconds);
        const earth = bodyCatalog[BodyId.Earth];
        assert.isDefined(earth.orbit);
        assert.isDefined(earth.rotation);
        const sunDirection = astronomyToScene(
            getOrbitPosition({
                orbit: earth.orbit,
                daysSinceJ2000,
            }).negate(),
        );
        const orientation = getBodyOrientation({
            rotation: earth.rotation,
            daysSinceJ2000,
        });
        return directionToLatitudeLongitude(sunDirection.applyQuaternion(orientation.invert()));
    }

    it('puts the Sun over the Tropic of Capricorn near Greenwich at J2000', () => {
        const subsolar = getSubsolarPoint(Date.UTC(2000, 0, 1, 12));
        assert.isApproximately(subsolar.latitudeDegrees, -23, 0.3);
        assert.isApproximately(subsolar.longitudeDegrees, 0.8, 1.5);
    });
    it('puts the Sun over the Tropic of Cancer at the June solstice', () => {
        const subsolar = getSubsolarPoint(Date.UTC(2024, 5, 20, 20, 51));
        assert.isApproximately(subsolar.latitudeDegrees, 23.44, 0.1);
    });
});
