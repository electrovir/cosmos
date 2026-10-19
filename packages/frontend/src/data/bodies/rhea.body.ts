import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const rheaRadiusKm = 763.8;

const rhea: BodyDetails = {
    id: BodyId.Rhea,
    description: [
        "Saturn's second largest moon, an icy ball heavily cratered on its leading side.",
        'Its ice and rock may never have fully separated, leaving it much the same all the way through.',
    ].join('\n\n'),
    massKg: 2.3065e21,
    meanTemperatureKelvin: 76,
    discovery: {
        year: 1672,
        discoverer: 'Giovanni Cassini',
    },
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#c4c0b8',
            radiusKm: {
                min: 0,
                max: rheaRadiusKm,
            },
            composition: 'Ice, with rock mixed in',
            description: 'Ice and rock that may never have fully settled apart.',
        },
    ],
};

export default rhea;
