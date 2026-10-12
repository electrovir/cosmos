import {assertWrap, check} from '@augment-vir/assert';

/** One point of a {@link RadialScale}: where a real radius is drawn. */
export type RadialScaleKnot = {
    realKm: number;
    displayKm: number;
};

/**
 * Stretches thin shells (like Earth's crust and atmosphere) so they're visible, by drawing each
 * real radius at a display radius. Straight lines connect the knots, which must increase in both
 * values and start at 0. Past the last knot the scale is 1:1 again, so distant things stay true to
 * scale.
 */
export type RadialScale = ReadonlyArray<Readonly<RadialScaleKnot>>;

export const trueRadialScale: RadialScale = [];

function interpolateKnots({
    scale,
    radiusKm,
    fromKey,
    toKey,
}: Readonly<{
    scale: RadialScale;
    radiusKm: number;
    fromKey: keyof RadialScaleKnot;
    toKey: keyof RadialScaleKnot;
}>) {
    const upperIndex = scale.findIndex((knot) => knot[fromKey] >= radiusKm);
    if (!check.isLengthAtLeast(scale, 1) || upperIndex === -1) {
        const last = scale.at(-1);
        return last ? radiusKm - last[fromKey] + last[toKey] : radiusKm;
    } else if (!upperIndex) {
        return scale[0][toKey];
    }
    const lower = assertWrap.isDefined(scale[upperIndex - 1]);
    const upper = assertWrap.isDefined(scale[upperIndex]);
    const progress = (radiusKm - lower[fromKey]) / (upper[fromKey] - lower[fromKey]);
    return lower[toKey] + progress * (upper[toKey] - lower[toKey]);
}

export function toDisplayRadius({
    scale,
    realKm,
}: Readonly<{
    scale: RadialScale;
    realKm: number;
}>) {
    return interpolateKnots({
        scale,
        radiusKm: realKm,
        fromKey: 'realKm',
        toKey: 'displayKm',
    });
}

export function toRealRadius({
    scale,
    displayKm,
}: Readonly<{
    scale: RadialScale;
    displayKm: number;
}>) {
    return interpolateKnots({
        scale,
        radiusKm: displayKm,
        fromKey: 'displayKm',
        toKey: 'realKm',
    });
}
