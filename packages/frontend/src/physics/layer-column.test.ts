import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import earth from '../data/bodies/earth.body.js';
import sun from '../data/bodies/sun.body.js';
import {CrustBoundary} from '../data/earth/earth-data-files.js';
import {
    findLayerAtRadius,
    getCutColumn,
    getLayerColumn,
    type LayerSegment,
} from './layer-column.js';

const earthRadiusKm = 6371;

function summarize(column: ReadonlyArray<Readonly<LayerSegment>>) {
    return column.map((segment) => {
        return [
            segment.layer.id,
            Math.round(segment.radiusKm.min - earthRadiusKm),
            Math.round(segment.radiusKm.max - earthRadiusKm),
        ];
    });
}

const oceanColumn = getLayerColumn({
    details: earth,
    surfaceRadiusKm: earthRadiusKm,
    surface: {
        elevationKm: -4,
        crustBoundariesKm: {
            [CrustBoundary.WaterBottom]: -4,
            [CrustBoundary.IceBottom]: -4,
            [CrustBoundary.SedimentBottom]: -5,
            [CrustBoundary.UpperCrustBottom]: -7,
            [CrustBoundary.MiddleCrustBottom]: -9,
            [CrustBoundary.Moho]: -11,
        },
    },
});

describe(getLayerColumn.name, () => {
    it('stacks an ocean column with no gaps and stretches the mantle up to the Moho', () => {
        assert.deepEquals(summarize(oceanColumn).slice(4, 11), [
            [
                'upper-mantle',
                -410,
                -11,
            ],
            [
                'lower-crust',
                -11,
                -9,
            ],
            [
                'middle-crust',
                -9,
                -7,
            ],
            [
                'upper-crust',
                -7,
                -5,
            ],
            [
                'sediments',
                -5,
                -4,
            ],
            [
                'ocean',
                -4,
                0,
            ],
            [
                'troposphere',
                0,
                12,
            ],
        ]);
        oceanColumn.slice(1).forEach((segment, index) => {
            assert.strictEquals(
                segment.radiusKm.min,
                assertWrap.isDefined(oceanColumn[index]).radiusKm.max,
            );
        });
    });
    it('stacks crust down from a mountain and shrinks the mantle to a deep Moho', () => {
        const column = getLayerColumn({
            details: earth,
            surfaceRadiusKm: earthRadiusKm,
            surface: {
                elevationKm: 5,
                crustBoundariesKm: {
                    [CrustBoundary.WaterBottom]: 5,
                    [CrustBoundary.IceBottom]: 4,
                    [CrustBoundary.SedimentBottom]: 4,
                    [CrustBoundary.UpperCrustBottom]: -20,
                    [CrustBoundary.MiddleCrustBottom]: -40,
                    [CrustBoundary.Moho]: -65,
                },
            },
        });
        assert.deepEquals(summarize(column).slice(4, 9), [
            [
                'upper-mantle',
                -410,
                -65,
            ],
            [
                'lower-crust',
                -65,
                -40,
            ],
            [
                'middle-crust',
                -40,
                -20,
            ],
            [
                'upper-crust',
                -20,
                4,
            ],
            [
                'ice',
                4,
                5,
            ],
        ]);
        assert.deepEquals(column[9]?.radiusKm, {
            min: earthRadiusKm + 5,
            max: earthRadiusKm + 12,
        });
    });
    it('uses typical radii without a surface sample', () => {
        assert.deepEquals(
            getLayerColumn({
                details: sun,
                surfaceRadiusKm: 695_700,
            }).map((segment) => segment.layer.id),
            sun.layers.map((layer) => layer.id),
        );
    });
    it('rejects a crust map naming a missing layer', () => {
        assert.throws(() => {
            return getLayerColumn({
                details: {
                    ...earth,
                    layers: earth.layers.filter((layer) => layer.id !== 'ice'),
                },
                surfaceRadiusKm: earthRadiusKm,
                surface: {
                    elevationKm: 0,
                    crustBoundariesKm: {
                        [CrustBoundary.WaterBottom]: 0,
                        [CrustBoundary.IceBottom]: 0,
                        [CrustBoundary.SedimentBottom]: 0,
                        [CrustBoundary.UpperCrustBottom]: 0,
                        [CrustBoundary.MiddleCrustBottom]: 0,
                        [CrustBoundary.Moho]: 0,
                    },
                },
            });
        });
    });
});

describe(getCutColumn.name, () => {
    it('gives hidden solid layers to the layer below and drops the ocean', () => {
        assert.deepEquals(summarize(getCutColumn(oceanColumn)).slice(7, 9), [
            [
                'upper-crust',
                -7,
                -4,
            ],
            [
                'troposphere',
                0,
                12,
            ],
        ]);
    });
    it('drops a hidden solid layer with nothing below it', () => {
        assert.deepEquals(
            getCutColumn(oceanColumn.filter((segment) => segment.layer.id === 'sediments')),
            [],
        );
    });
});

describe(findLayerAtRadius.name, () => {
    it('finds the layer holding a radius', () => {
        assert.deepEquals(
            [
                0,
                earthRadiusKm - 2,
                earthRadiusKm + 100_000,
            ].map((radiusKm) => {
                return findLayerAtRadius({
                    column: oceanColumn,
                    radiusKm,
                })?.layer.id;
            }),
            [
                'inner-core',
                'ocean',
                undefined,
            ],
        );
    });
});
