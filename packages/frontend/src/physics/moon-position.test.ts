// cspell:words meeus
import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {radiansToDegrees} from './angles.js';
import {getMoonPosition} from './moon-position.js';
import {getDaysSinceJ2000} from './orbit.js';

describe(getMoonPosition.name, () => {
    it('matches the worked example in Meeus’ Astronomical Algorithms', () => {
        /**
         * Example 47.a, at 1992 April 12 0h. The example's longitude is of that date, so the J2000
         * longitude is about 0.11° more.
         */
        const position = getMoonPosition(getDaysSinceJ2000(Date.UTC(1992, 3, 12)));
        assert.isApproximately(radiansToDegrees(Math.atan2(position.y, position.x)), 133.27, 0.5);
        assert.isApproximately(
            radiansToDegrees(Math.asin(position.z / position.length())),
            -3.229,
            0.3,
        );
        assert.isApproximately(position.length(), 368_410, 1500);
    });
});
