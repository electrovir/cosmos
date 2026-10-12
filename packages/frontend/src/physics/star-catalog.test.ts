import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getStarColor, parseStarCatalog} from './star-catalog.js';

describe(parseStarCatalog.name, () => {
    it('reads each star from five values', () => {
        const stars = parseStarCatalog(
            new Float32Array([
                0,
                0,
                1,
                2.5,
                -0.25,
            ]).buffer,
        );
        assert.isLengthExactly(stars, 1);
        assert.deepEquals(
            {
                ...stars[0],
                direction: stars[0].direction.toArray(),
            },
            {
                direction: [
                    0,
                    0,
                    1,
                ],
                visualMagnitude: 2.5,
                colorIndex: -0.25,
            },
        );
    });
    it('rejects a partial star', () => {
        assert.throws(() => parseStarCatalog(new Float32Array(4).buffer));
    });
});

describe(getStarColor.name, () => {
    it('makes hot stars blue, cool stars red, and the Sun nearly white', () => {
        const blue = getStarColor(-0.3);
        const red = getStarColor(1.85);
        const sunLike = getStarColor(0.65);
        assert.isAbove(blue.b, blue.r);
        assert.isAbove(red.r, red.b);
        assert.isAbove(sunLike.b, 0.7);
        assert.strictEquals(sunLike.r, 1);
        assert.strictEquals(getStarColor(5).b, 0);
    });
});
