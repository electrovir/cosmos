import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {bodyCatalog, loadBodyDetails} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {formatNumber, formatPeriod, getAxialTiltDegrees, getBodyStats} from './body-stats.js';

describe(formatNumber.name, () => {
    it('rounds to significant digits with grouping', () => {
        assert.strictEquals(formatNumber(332_946.05), '333,000');
    });
    it('writes tiny values in scientific notation', () => {
        assert.strictEquals(formatNumber(0.000247), '2.5 × 10⁻⁴');
    });
});

describe(formatPeriod.name, () => {
    it('uses hours and minutes under two days', () => {
        assert.strictEquals(formatPeriod(0.99727), '23 h 56 m');
    });
    it('uses years past two years', () => {
        assert.strictEquals(formatPeriod(4332.59), '11.9 years');
    });
});

describe(getAxialTiltDegrees.name, () => {
    it("matches Earth's tilt", () => {
        assert.isAbove(assertWrap.isDefined(getAxialTiltDegrees(bodyCatalog[BodyId.Earth])), 23.4);
        assert.isBelow(assertWrap.isDefined(getAxialTiltDegrees(bodyCatalog[BodyId.Earth])), 23.5);
    });
    it('is past 90° for a body that spins backward', () => {
        assert.isAbove(assertWrap.isDefined(getAxialTiltDegrees(bodyCatalog[BodyId.Venus])), 177);
    });
});

describe(getBodyStats.name, () => {
    it('fills every stat for Earth', async () => {
        const stats = getBodyStats({
            summary: bodyCatalog[BodyId.Earth],
            details: await loadBodyDetails(BodyId.Earth),
        });
        assert.deepEquals(
            stats.filter((stat) => {
                return [
                    'Mass',
                    'Surface gravity',
                    'Mean distance',
                ].includes(stat.label);
            }),
            [
                {
                    label: 'Mass',
                    value: '1 Earth',
                },
                {
                    label: 'Surface gravity',
                    value: '1 g',
                },
                {
                    label: 'Mean distance',
                    value: '1 AU from the Sun',
                },
            ],
        );
    });
    it('dashes stats that do not apply to the Sun', async () => {
        const stats = getBodyStats({
            summary: bodyCatalog[BodyId.Sun],
            details: await loadBodyDetails(BodyId.Sun),
        });
        assert.deepEquals(
            stats.filter((stat) => {
                return [
                    'Discovered by',
                    'Orbital period',
                    'Surface pressure',
                ].includes(stat.label);
            }),
            [
                {
                    label: 'Discovered by',
                    value: '–',
                },
                {
                    label: 'Orbital period',
                    value: '–',
                },
                {
                    label: 'Surface pressure',
                    value: '–',
                },
            ],
        );
    });
});
