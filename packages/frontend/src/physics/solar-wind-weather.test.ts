import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    advanceSolarWind,
    createRandom,
    getSolarWindConditions,
    quietSolarWind,
    smoothSolarWindConditions,
    type SolarWindState,
} from './solar-wind-weather.js';

function simulate({seed, steps}: Readonly<{seed: number; steps: number}>) {
    const random = createRandom(seed);
    return createArray(steps, () => undefined).reduce<SolarWindState[]>((states) => {
        return [
            ...states,
            advanceSolarWind({
                state: states.at(-1) ?? quietSolarWind,
                elapsedSeconds: 0.5,
                random,
            }),
        ];
    }, []);
}

describe(createRandom.name, () => {
    it('repeats for the same seed and stays in [0, 1)', () => {
        const first = createArray(100, createRandom(7));
        assert.deepEquals(first, createArray(100, createRandom(7)));
        assert.isTrue(first.every((value) => value >= 0 && value < 1));
    });
});

describe(getSolarWindConditions.name, () => {
    it('computes typical ram pressure for quiet wind', () => {
        const conditions = getSolarWindConditions(quietSolarWind);
        assert.isApproximately(conditions.dynamicPressureNanopascals, 1.34, 0.01);
        assert.isFalse(conditions.isCoronalMassEjection);
    });
});

describe(advanceSolarWind.name, () => {
    const states = simulate({
        seed: 1,
        steps: 2000,
    });
    const conditions = states.map(getSolarWindConditions);

    it('has coronal mass ejections that speed up the wind and push the field south', () => {
        const ejections = conditions.filter((condition) => condition.isCoronalMassEjection);
        assert.isLengthAtLeast(ejections, 1);
        assert.isTrue(ejections.some((condition) => condition.speedKmPerSecond > 650));
        assert.isTrue(ejections.some((condition) => condition.fieldZNanotesla < -8));
    });
    it('keeps activity between 0 and 1 and raises it during storms', () => {
        assert.isTrue(
            conditions.every((condition) => condition.activity >= 0 && condition.activity <= 1),
        );
        assert.isAbove(Math.max(...conditions.map((condition) => condition.activity)), 0.6);
    });
});

describe(smoothSolarWindConditions.name, () => {
    const previous = getSolarWindConditions(quietSolarWind);
    const next = {
        ...previous,
        speedKmPerSecond: previous.speedKmPerSecond + 100,
        isCoronalMassEjection: true,
    };

    it('moves part of the way toward the new conditions', () => {
        const smoothed = smoothSolarWindConditions({
            previous,
            next,
            elapsedSeconds: 1,
            timeScaleSeconds: 1,
        });
        assert.isApproximately(
            smoothed.speedKmPerSecond,
            previous.speedKmPerSecond + 100 * (1 - Math.exp(-1)),
            0.001,
        );
        assert.isTrue(smoothed.isCoronalMassEjection);
    });

    it('stays put when no time passes', () => {
        assert.deepEquals(
            smoothSolarWindConditions({
                previous,
                next,
                elapsedSeconds: 0,
                timeScaleSeconds: 1,
            }),
            {
                ...previous,
                isCoronalMassEjection: true,
            },
        );
    });
});
