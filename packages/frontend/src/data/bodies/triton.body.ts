// cspell:words kuiper
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const tritonRadiusKm = 1353.4;

/** Layer sizes are rough, from its size and density. */
const triton: BodyDetails = {
    id: BodyId.Triton,
    description: [
        "Neptune's largest moon, and the only large moon that orbits backward, against its planet's spin. It was probably a world from the Kuiper Belt, like Pluto, that Neptune captured.",
        'Voyager 2 saw geysers of nitrogen gas on it. At about 38 kelvins, its surface is among the coldest ever measured.',
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
                max: 950,
            },
            composition: 'Rock and metal',
            description: 'Rock making up about two thirds of its mass.',
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#d8ccc4',
            radiusKm: {
                min: 950,
                max: tritonRadiusKm,
            },
            composition: 'Water ice, under frozen nitrogen',
            description:
                'Ice coated in frozen nitrogen and methane, with a cantaloupe-like rumpled terrain.',
            temperatureKelvin: {
                min: 38,
                max: 38,
            },
        },
    ],
};

export default triton;
