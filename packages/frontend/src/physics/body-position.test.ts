import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {bodyCatalog} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {getBodyPosition} from './body-position.js';

describe(getBodyPosition.name, () => {
    const daysSinceJ2000 = 9000;

    it('places the Sun at the origin', () => {
        assert.strictEquals(
            getBodyPosition({
                bodyId: BodyId.Sun,
                daysSinceJ2000,
            }).length(),
            0,
        );
    });

    it('keeps a moon on its orbit around its moving planet', () => {
        const orbit = assertWrap.isDefined(bodyCatalog[BodyId.Io].orbit);
        const distanceKm = getBodyPosition({
            bodyId: BodyId.Io,
            daysSinceJ2000,
        })
            .sub(
                getBodyPosition({
                    bodyId: BodyId.Jupiter,
                    daysSinceJ2000,
                }),
            )
            .length();

        assert.isAbove(distanceKm, orbit.semiMajorAxisKm * (1 - orbit.eccentricity) - 1);
        assert.isBelow(distanceKm, orbit.semiMajorAxisKm * (1 + orbit.eccentricity) + 1);
    });

    it("keeps Earth's Moon between perigee and apogee", () => {
        const distanceKm = getBodyPosition({
            bodyId: BodyId.Moon,
            daysSinceJ2000,
        })
            .sub(
                getBodyPosition({
                    bodyId: BodyId.Earth,
                    daysSinceJ2000,
                }),
            )
            .length();

        assert.isAbove(distanceKm, 356_000);
        assert.isBelow(distanceKm, 407_000);
    });
});
