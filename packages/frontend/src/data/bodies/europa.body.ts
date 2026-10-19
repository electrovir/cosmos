// cspell:words anderson
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const europaRadiusKm = 1560.8;

/**
 * Layer sizes are from models fit to Galileo's gravity measurements (Anderson et al., 1998). The
 * ice shell's thickness is uncertain.
 */
const europa: BodyDetails = {
    id: BodyId.Europa,
    description: [
        "An icy moon a little smaller than Earth's Moon, with a smooth surface crossed by long reddish cracks.",
        "Under its ice is a global ocean of salty water, with about twice as much water as all of Earth's oceans. That makes it one of the likeliest places to look for life beyond Earth.",
    ].join('\n\n'),
    massKg: 4.7998e22,
    meanTemperatureKelvin: 102,
    discovery: {
        year: 1610,
        discoverer: 'Galileo Galilei',
    },
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#c8a070',
            radiusKm: {
                min: 0,
                max: 600,
            },
            composition: 'Iron and iron sulfide',
            description: "Metal making up about a tenth of Europa's volume.",
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 600,
                max: europaRadiusKm - 120,
            },
            composition: 'Silicate rock',
            description: 'Rock that may heat the ocean from below, perhaps through seafloor vents.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: europaRadiusKm - 120,
                max: europaRadiusKm - 20,
            },
            composition: 'Salty water',
            description: 'A dark ocean kept liquid by tidal flexing.',
            temperatureKelvin: {
                min: 260,
                max: 273,
            },
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#d8c8b0',
            radiusKm: {
                min: europaRadiusKm - 20,
                max: europaRadiusKm,
            },
            composition: 'Water ice, stained by salts and sulfur',
            description: 'Ice that cracks and shifts as Jupiter flexes it.',
            temperatureKelvin: {
                min: 100,
                max: 260,
            },
        },
    ],
};

export default europa;
