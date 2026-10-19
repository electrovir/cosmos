// cspell:words chasma messina
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const titaniaRadiusKm = 788.9;

const titania: BodyDetails = {
    id: BodyId.Titania,
    description:
        "Uranus' largest moon. Canyons over a thousand kilometers long cross it, cracked open as its insides froze and swelled.",
    massKg: 3.4e21,
    meanTemperatureKelvin: 70,
    discovery: {
        year: 1787,
        discoverer: 'William Herschel',
    },
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a49c94',
            radiusKm: {
                min: 0,
                max: titaniaRadiusKm,
            },
            composition: 'Ice and rock',
            description: 'About half ice and half rock.',
        },
    ],
};

export default titania;
