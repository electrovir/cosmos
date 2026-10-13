// cspell:words rupes verona
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const mirandaRadiusKm = 235.8;

const miranda: BodyDetails = {
    id: BodyId.Miranda,
    description: [
        "The smallest of Uranus' five large moons, with a patchwork surface of cliffs, grooves, and ridges unlike any other.",
        'Its cliff Verona Rupes may be up to 20 kilometers high, the tallest known in the Solar System.',
    ].join('\n\n'),
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a8a8a8',
            radiusKm: {
                min: 0,
                max: mirandaRadiusKm,
            },
            composition: 'Ice and rock',
            description:
                'Ice and rock that may have been jumbled as it froze, or by a giant impact.',
        },
    ],
};

export default miranda;
