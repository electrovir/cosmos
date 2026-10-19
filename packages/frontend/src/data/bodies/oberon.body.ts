import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const oberonRadiusKm = 761.4;

const oberon: BodyDetails = {
    id: BodyId.Oberon,
    description: [
        "Uranus' outermost large moon, old and heavily cratered, with dark material on some crater floors.",
        'Voyager 2 spotted a mountain about 11 kilometers high along its edge.',
    ].join('\n\n'),
    massKg: 3.076e21,
    meanTemperatureKelvin: 75,
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
            color: '#988c84',
            radiusKm: {
                min: 0,
                max: oberonRadiusKm,
            },
            composition: 'Ice and rock',
            description: 'About half ice and half rock.',
        },
    ],
};

export default oberon;
