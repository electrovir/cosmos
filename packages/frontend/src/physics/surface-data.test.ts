import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import earth from '../data/bodies/earth.body.js';
import {bodyCatalog} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {earthDataFileNames} from '../data/earth/earth-data-files.js';
import {getLayerColumn} from './layer-column.js';
import {parseEarthSurfaceData, sampleSurface} from './surface-data.js';

async function loadEarthSurfaceData() {
    const [
        elevationBytes,
        crustBytes,
    ] = await Promise.all(
        [
            earthDataFileNames.elevation,
            earthDataFileNames.crust,
        ].map(async (fileName) => {
            return await (await fetch(`/www-static/earth/${fileName}`)).arrayBuffer();
        }),
    );
    return parseEarthSurfaceData({
        elevationBytes: assertWrap.isDefined(elevationBytes),
        crustBytes: assertWrap.isDefined(crustBytes),
    });
}

const earthSurfaceData = loadEarthSurfaceData();

async function sampleEarth({
    latitudeDegrees,
    longitudeDegrees,
}: Readonly<{
    latitudeDegrees: number;
    longitudeDegrees: number;
}>) {
    const surface = sampleSurface({
        data: await earthSurfaceData,
        latitudeDegrees,
        longitudeDegrees,
    });
    return {
        surface,
        column: getLayerColumn({
            details: earth,
            surfaceRadiusKm: bodyCatalog[BodyId.Earth].radiusKm,
            surface,
        }),
    };
}

describe(sampleSurface.name, () => {
    it('finds thick crust under Tibet', async () => {
        const {surface} = await sampleEarth({
            latitudeDegrees: 32,
            longitudeDegrees: 88,
        });
        assert.isAbove(surface.elevationKm, 4);
        assert.isBelow(surface.crustBoundariesKm.moho, -60);
    });
    it('finds deep ocean and thin crust in the middle of the Pacific', async () => {
        const {surface, column} = await sampleEarth({
            latitudeDegrees: 10,
            longitudeDegrees: -150,
        });
        assert.isBelow(surface.elevationKm, -4);
        assert.isAbove(surface.crustBoundariesKm.moho, -15);
        assert.isTrue(column.some((segment) => segment.layer.id === 'ocean'));
    });
});

describe(parseEarthSurfaceData.name, () => {
    it('rejects files of the wrong size', () => {
        assert.throws(() => {
            return parseEarthSurfaceData({
                elevationBytes: new ArrayBuffer(4),
                crustBytes: new ArrayBuffer(4),
            });
        });
    });
});
