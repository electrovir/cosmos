import {assertWrap} from '@augment-vir/assert';
import {Vector3} from 'three';
import {bodyCatalog} from '../data/body-catalog.js';
import {BodyId} from '../data/celestial-body.js';
import {getMoonPosition} from './moon-position.js';
import {getOrbitPosition} from './orbit.js';

/** For a body whose orbit elements are around its parent, wherever the parent is. */
function createOrbitGetter(bodyId: BodyId) {
    return (daysSinceJ2000: number) => {
        const parentId = assertWrap.isDefined(bodyCatalog[bodyId].parentId);
        return bodyPositionGetters[parentId](daysSinceJ2000).add(
            getOrbitPosition({
                orbit: assertWrap.isDefined(bodyCatalog[bodyId].orbit),
                daysSinceJ2000,
            }),
        );
    };
}

const bodyPositionGetters: Readonly<Record<BodyId, (daysSinceJ2000: number) => Vector3>> = {
    [BodyId.Sun]() {
        return new Vector3();
    },
    [BodyId.Mercury]: createOrbitGetter(BodyId.Mercury),
    [BodyId.Venus]: createOrbitGetter(BodyId.Venus),
    /** Earth's elements are for the Earth-Moon barycenter, which is within Earth's radius of it. */
    [BodyId.Earth]: createOrbitGetter(BodyId.Earth),
    [BodyId.Moon](daysSinceJ2000) {
        return bodyPositionGetters[BodyId.Earth](daysSinceJ2000).add(
            getMoonPosition(daysSinceJ2000),
        );
    },
    [BodyId.Mars]: createOrbitGetter(BodyId.Mars),
    [BodyId.Phobos]: createOrbitGetter(BodyId.Phobos),
    [BodyId.Deimos]: createOrbitGetter(BodyId.Deimos),
    [BodyId.Jupiter]: createOrbitGetter(BodyId.Jupiter),
    [BodyId.Io]: createOrbitGetter(BodyId.Io),
    [BodyId.Europa]: createOrbitGetter(BodyId.Europa),
    [BodyId.Ganymede]: createOrbitGetter(BodyId.Ganymede),
    [BodyId.Callisto]: createOrbitGetter(BodyId.Callisto),
    [BodyId.Saturn]: createOrbitGetter(BodyId.Saturn),
    [BodyId.Mimas]: createOrbitGetter(BodyId.Mimas),
    [BodyId.Enceladus]: createOrbitGetter(BodyId.Enceladus),
    [BodyId.Tethys]: createOrbitGetter(BodyId.Tethys),
    [BodyId.Dione]: createOrbitGetter(BodyId.Dione),
    [BodyId.Rhea]: createOrbitGetter(BodyId.Rhea),
    [BodyId.Titan]: createOrbitGetter(BodyId.Titan),
    [BodyId.Iapetus]: createOrbitGetter(BodyId.Iapetus),
    [BodyId.Uranus]: createOrbitGetter(BodyId.Uranus),
    [BodyId.Miranda]: createOrbitGetter(BodyId.Miranda),
    [BodyId.Ariel]: createOrbitGetter(BodyId.Ariel),
    [BodyId.Umbriel]: createOrbitGetter(BodyId.Umbriel),
    [BodyId.Titania]: createOrbitGetter(BodyId.Titania),
    [BodyId.Oberon]: createOrbitGetter(BodyId.Oberon),
    [BodyId.Neptune]: createOrbitGetter(BodyId.Neptune),
    [BodyId.Triton]: createOrbitGetter(BodyId.Triton),
    [BodyId.Pluto]: createOrbitGetter(BodyId.Pluto),
    [BodyId.Charon]: createOrbitGetter(BodyId.Charon),
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
