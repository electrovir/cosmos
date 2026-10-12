import {assert, assertWrap} from '@augment-vir/assert';
import {getObjectTypedValues} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {loadBodyDetails} from './body-catalog.js';
import {BodyId, LayerRegion} from './celestial-body.js';

describe(loadBodyDetails.name, () => {
    getObjectTypedValues(BodyId).forEach((bodyId) => {
        it(`has valid layers for ${bodyId}`, async () => {
            const details = await loadBodyDetails(bodyId);
            assert.strictEquals(details.id, bodyId);
            const layerIds = details.layers.map((layer) => layer.id);
            assert.strictEquals(new Set(layerIds).size, layerIds.length);

            [
                LayerRegion.Interior,
                LayerRegion.Atmosphere,
            ].forEach((region) => {
                const stack = details.layers.filter((layer) => layer.region === region);
                stack.slice(1).forEach((layer, index) => {
                    assert.strictEquals(
                        layer.radiusKm.min,
                        assertWrap.isDefined(stack[index]).radiusKm.max,
                    );
                });
            });
        });
    });
});
