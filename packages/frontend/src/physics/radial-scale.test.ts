import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {type RadialScale, toDisplayRadius, toRealRadius, trueRadialScale} from './radial-scale.js';

const scale: RadialScale = [
    {
        realKm: 0,
        displayKm: 0,
    },
    {
        realKm: 90,
        displayKm: 50,
    },
    {
        realKm: 100,
        displayKm: 150,
    },
];

describe(toDisplayRadius.name, () => {
    it('stretches between knots', () => {
        assert.deepEquals(
            [
                0,
                45,
                95,
                100,
                200,
            ].map((realKm) => {
                return toDisplayRadius({
                    scale,
                    realKm,
                });
            }),
            [
                0,
                25,
                100,
                150,
                250,
            ],
        );
    });
    it('changes nothing at true scale', () => {
        assert.strictEquals(
            toDisplayRadius({
                scale: trueRadialScale,
                realKm: 1234,
            }),
            1234,
        );
    });
});

describe(toRealRadius.name, () => {
    it('undoes toDisplayRadius', () => {
        [
            0,
            45,
            95,
            200,
        ].forEach((realKm) => {
            assert.isApproximately(
                toRealRadius({
                    scale,
                    displayKm: toDisplayRadius({
                        scale,
                        realKm,
                    }),
                }),
                realKm,
                1e-9,
            );
        });
    });
});
