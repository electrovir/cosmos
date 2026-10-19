// cspell:words wunda lassell
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const umbrielRadiusKm = 584.7;

const umbriel: BodyDetails = {
    id: BodyId.Umbriel,
    description: [
        "The darkest of Uranus' large moons, with an old surface covered in craters.",
        'A bright ring called Wunda sits on the floor of a crater near its equator. No one knows what it is made of.',
    ].join('\n\n'),
    massKg: 1.275e21,
    meanTemperatureKelvin: 75,
    discovery: {
        year: 1851,
        discoverer: 'William Lassell',
    },
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#6c6a68',
            radiusKm: {
                min: 0,
                max: umbrielRadiusKm,
            },
            composition: 'Ice and rock',
            description: 'About half ice and half rock, under a dark coating.',
        },
    ],
};

export default umbriel;
