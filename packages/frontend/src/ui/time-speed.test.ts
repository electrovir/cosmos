import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {advanceShownTime, formatTimeSpeed, getTimeSpeed} from './time-speed.js';

const siderealDayMilliseconds = 86_164_091;

describe(getTimeSpeed.name, () => {
    it('runs in real time at the far left and a month per second at the far right', () => {
        assert.deepEquals(
            [
                0,
                0.25,
                0.5,
                1,
            ].map((position) => formatTimeSpeed(getTimeSpeed(position))),
            [
                'Real time',
                '1 hour per second',
                '1 day per second',
                '1 month per second',
            ],
        );
    });
    it('speeds up smoothly between stops', () => {
        assert.isAbove(getTimeSpeed(0.6), getTimeSpeed(0.5));
        assert.isBelow(getTimeSpeed(0.6), getTimeSpeed(0.75));
    });
});

describe(advanceShownTime.name, () => {
    it('spins along with the shown time when time is slow', () => {
        assert.deepEquals(
            advanceShownTime({
                shownMilliseconds: 0,
                spinLagMilliseconds: 0,
                frameSeconds: 1,
                speed: 3600,
                spinPeriodMilliseconds: siderealDayMilliseconds,
            }),
            {
                shownMilliseconds: 3_600_000,
                spinLagMilliseconds: 0,
            },
        );
    });
    it('keeps the spin lag under one turn when time is fast', () => {
        const advanced = advanceShownTime({
            shownMilliseconds: 0,
            spinLagMilliseconds: 0,
            frameSeconds: 1,
            speed: getTimeSpeed(1),
            spinPeriodMilliseconds: siderealDayMilliseconds,
        });
        assert.isAbove(advanced.spinLagMilliseconds, 0);
        assert.isBelow(advanced.spinLagMilliseconds, siderealDayMilliseconds);
    });
    it('catches the spin back up once time slows down', () => {
        const advanced = advanceShownTime({
            shownMilliseconds: 0,
            spinLagMilliseconds: 3_600_000,
            frameSeconds: 1,
            speed: 1,
            spinPeriodMilliseconds: siderealDayMilliseconds,
        });
        assert.strictEquals(advanced.spinLagMilliseconds, 0);
    });
});
