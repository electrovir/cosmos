// cspell:words beuthe
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const dioneRadiusKm = 561.4;

/**
 * Layer sizes are from a model fit to Cassini's gravity measurements (Beuthe et al., 2016), and are
 * rough.
 */
const dione: BodyDetails = {
    id: BodyId.Dione,
    description: [
        'An icy moon whose trailing side is streaked with bright cliffs of ice, hundreds of meters high.',
        "Cassini's measurements hint at a thin ocean deep under its ice, around a large rocky core.",
    ].join('\n\n'),
    massKg: 1.0955e21,
    meanTemperatureKelvin: 87,
    discovery: {
        year: 1684,
        discoverer: 'Giovanni Cassini',
    },
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 0,
                max: 400,
            },
            composition: 'Rock',
            description: 'A rocky core making up most of its mass.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: 400,
                max: dioneRadiusKm - 100,
            },
            composition: 'Salty water',
            description: 'A probable thin ocean, kept from freezing by tidal flexing.',
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#c8c6c0',
            radiusKm: {
                min: dioneRadiusKm - 100,
                max: dioneRadiusKm,
            },
            composition: 'Water ice',
            description: 'Ice cracked into bright cliffs on one side.',
        },
    ],
};

export default dione;
