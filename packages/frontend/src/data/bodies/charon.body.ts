// cspell:words mckinnon mordor
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const charonRadiusKm = 606;

/**
 * Layer sizes are rough, from models fit to New Horizons measurements of its size and density
 * (McKinnon et al., 2017).
 */
const charon: BodyDetails = {
    id: BodyId.Charon,
    description: [
        "Pluto's largest moon, half as wide as Pluto. They are so close in size that they circle a point in the space between them, each always showing the other the same face.",
        'Its north pole is stained reddish by gas that escapes Pluto and freezes onto it.',
    ].join('\n\n'),
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 0,
                max: 410,
            },
            composition: 'Rock',
            description: 'A core of rock making up most of its mass.',
        },
        {
            id: 'ice-mantle',
            name: 'Ice mantle',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#9a948c',
            radiusKm: {
                min: 410,
                max: charonRadiusKm,
            },
            composition: 'Water ice',
            description:
                'Ice that once held an ocean, whose freezing split the surface with canyons.',
        },
    ],
};

export default charon;
