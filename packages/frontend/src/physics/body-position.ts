import {assertWrap} from '@augment-vir/assert';
import {Vector3} from 'three';
import {bodyCatalog} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {getMoonPosition} from './moon-position.js';
import {getOrbitPosition} from './orbit.js';

const bodyPositionGetters: Readonly<Record<BodyId, (daysSinceJ2000: number) => Vector3>> = {
    [BodyId.Sun]() {
        return new Vector3();
    },
    /** Earth's elements are for the Earth-Moon barycenter, which is within Earth's radius of it. */
    [BodyId.Earth](daysSinceJ2000) {
        return getOrbitPosition({
            orbit: assertWrap.isDefined(bodyCatalog[BodyId.Earth].orbit),
            daysSinceJ2000,
        });
    },
    [BodyId.Moon](daysSinceJ2000) {
        return bodyPositionGetters[BodyId.Earth](daysSinceJ2000).add(
            getMoonPosition(daysSinceJ2000),
        );
    },
};

/** Where a body is relative to the Sun, in kilometers in the J2000 ecliptic astronomy frame. */
export function getBodyPosition({
    bodyId,
    daysSinceJ2000,
}: Readonly<{
    bodyId: BodyId;
    daysSinceJ2000: number;
}>) {
    return bodyPositionGetters[bodyId](daysSinceJ2000);
}
