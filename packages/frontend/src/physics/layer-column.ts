import {assertWrap} from '@augment-vir/assert';
import {mapObjectValues} from '@augment-vir/common';
import {
    type BodyDetails,
    type BodyLayer,
    LayerRegion,
    MatterState,
    type ValueRange,
} from '../data/celestial-body.js';
import {CrustBoundary, crustBoundaryOrder} from '../data/earth/earth-data-files.js';

/** What the surface data says about one spot, with heights in kilometers relative to sea level. */
export type SurfaceSample = {
    /** The top of the ground, ice, or ocean floor. */
    elevationKm: number;
    crustBoundariesKm: Readonly<Record<CrustBoundary, number>>;
};

export type LayerSegment = {
    layer: Readonly<BodyLayer>;
    radiusKm: ValueRange;
};

/**
 * Every layer straight down from the top of the atmosphere to the center at one spot, ordered from
 * the center outward with no gaps and no empty segments. Without a surface sample (or for a body
 * with no crust grid) every layer uses its typical radii.
 */
export function getLayerColumn({
    details,
    surfaceRadiusKm,
    surface,
}: Readonly<{
    details: Readonly<Pick<BodyDetails, 'layers' | 'crust'>>;
    /** Sea level, for a body with oceans. */
    surfaceRadiusKm: number;
    surface?: Readonly<SurfaceSample> | undefined;
}>) {
    if (!details.crust || !surface) {
        return details.layers.map((layer) => {
            return {
                layer,
                radiusKm: layer.radiusKm,
            };
        });
    }

    const solidTopKm = surfaceRadiusKm + surface.elevationKm;
    const crustLayers = mapObjectValues(details.crust.layerIdsByBoundary, (boundary, layerId) => {
        return assertWrap.isDefined(
            details.layers.find((layer) => layer.id === layerId),
            `Crust layer '${layerId}' is not one of the body's layers.`,
        );
    });

    const solidCrust = crustBoundaryOrder.slice(1).reduce<{
        segments: LayerSegment[];
        topKm: number;
    }>(
        (accumulator, boundary, index) => {
            const thicknessKm =
                assertWrap.isDefined(
                    surface.crustBoundariesKm[assertWrap.isDefined(crustBoundaryOrder[index])],
                ) - surface.crustBoundariesKm[boundary];
            const bottomKm = accumulator.topKm - thicknessKm;
            return {
                segments: [
                    {
                        layer: crustLayers[boundary],
                        radiusKm: {
                            min: bottomKm,
                            max: accumulator.topKm,
                        },
                    },
                    ...accumulator.segments,
                ],
                topKm: bottomKm,
            };
        },
        {
            segments: [],
            topKm: solidTopKm,
        },
    );
    const mohoKm = solidCrust.topKm;
    const atmosphereBottomKm = Math.max(solidTopKm, surfaceRadiusKm);

    const interiorLayers = details.layers.filter(
        (layer) => layer.region === LayerRegion.Interior && layer.radiusKm.min < mohoKm,
    );
    const atmosphereLayers = details.layers.filter((layer) => {
        return layer.region === LayerRegion.Atmosphere && layer.radiusKm.max > atmosphereBottomKm;
    });
    /** The crust's bottom and top vary, so the layers touching it stretch or shrink to meet it. */
    const interior = interiorLayers.map((layer, index): LayerSegment => {
        return {
            layer,
            radiusKm: {
                min: layer.radiusKm.min,
                max: index === interiorLayers.length - 1 ? mohoKm : layer.radiusKm.max,
            },
        };
    });
    const atmosphere = atmosphereLayers.map((layer, index): LayerSegment => {
        return {
            layer,
            radiusKm: {
                min: index ? layer.radiusKm.min : atmosphereBottomKm,
                max: layer.radiusKm.max,
            },
        };
    });
    const ocean = [
        {
            layer: crustLayers[CrustBoundary.WaterBottom],
            radiusKm: {
                min: solidTopKm,
                max: surfaceRadiusKm,
            },
        },
    ];

    return [
        ...interior,
        ...solidCrust.segments,
        ...ocean,
        ...atmosphere,
    ].filter((segment) => segment.radiusKm.max > segment.radiusKm.min);
}

/** A column as the cut face draws it, without the layers marked `isHiddenInCut`. */
export function getCutColumn(column: ReadonlyArray<Readonly<LayerSegment>>) {
    return column.reduce<LayerSegment[]>((segments, segment) => {
        const below = segments.at(-1);
        if (!segment.layer.isHiddenInCut) {
            return [
                ...segments,
                segment,
            ];
        } else if (segment.layer.state === MatterState.Solid && below) {
            return [
                ...segments.slice(0, -1),
                {
                    ...below,
                    radiusKm: {
                        min: below.radiusKm.min,
                        max: segment.radiusKm.max,
                    },
                },
            ];
        } else {
            return segments;
        }
    }, []);
}

/** The segment of a column that holds a radius, or `undefined` past the top of the column. */
export function findLayerAtRadius({
    column,
    radiusKm,
}: Readonly<{
    column: ReadonlyArray<Readonly<LayerSegment>>;
    radiusKm: number;
}>) {
    return column.find((segment) => radiusKm <= segment.radiusKm.max);
}
