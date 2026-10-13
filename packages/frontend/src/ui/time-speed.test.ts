import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {advanceSpinLag, formatTimeSpeed, getTimeSpeed} from './time-speed.js';

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

describe(advanceSpinLag.name, () => {
    it('spins along with the shown time when time is slow', () => {
        assert.strictEquals(
            advanceSpinLag({
                spinLagMilliseconds: 0,
                frameSeconds: 1,
                speed: 3600,
                spinPeriodMilliseconds: siderealDayMilliseconds,
            }),
            0,
        );
    });
    it('keeps the spin lag under one turn when time is fast', () => {
        const spinLagMilliseconds = advanceSpinLag({
            spinLagMilliseconds: 0,
            frameSeconds: 1,
            speed: getTimeSpeed(1),
            spinPeriodMilliseconds: siderealDayMilliseconds,
        });
        assert.isAbove(spinLagMilliseconds, 0);
        assert.isBelow(spinLagMilliseconds, siderealDayMilliseconds);
    });
    it('catches the spin back up once time slows down', () => {
        assert.strictEquals(
            advanceSpinLag({
                spinLagMilliseconds: 3_600_000,
                frameSeconds: 1,
                speed: 1,
                spinPeriodMilliseconds: siderealDayMilliseconds,
            }),
            0,
        );
    });
});
