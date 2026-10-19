// cspell:words iess
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const enceladusRadiusKm = 252.1;

/**
 * Layer sizes are from Cassini's gravity measurements and the wobble of its spin (Iess et al.,
 * 2014; Thomas et al., 2016).
 */
const enceladus: BodyDetails = {
    id: BodyId.Enceladus,
    description: [
        'A small moon covered in fresh ice, the most reflective world in the Solar System.',
        "Jets of water vapor and ice burst from cracks near its south pole, fed by a salty global ocean under the ice. The jets supply Saturn's faint E ring.",
    ].join('\n\n'),
    massKg: 1.0802e20,
    meanTemperatureKelvin: 75,
    discovery: {
        year: 1789,
        discoverer: 'William Herschel',
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
                max: 190,
            },
            composition: 'Porous rock',
            description: 'Rock riddled with water, which hot water vents may be warming.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: 190,
                max: enceladusRadiusKm - 20,
            },
            composition: 'Salty water',
            description:
                'A global ocean whose spray Cassini flew through, finding salts and organic molecules.',
            temperatureKelvin: {
                min: 273,
                max: 273,
            },
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#f4f6f8',
            radiusKm: {
                min: enceladusRadiusKm - 20,
                max: enceladusRadiusKm,
            },
            composition: 'Water ice',
            description:
                'Ice about 20 kilometers thick, thinning to a few kilometers at the south pole.',
            temperatureKelvin: {
                min: 70,
                max: 273,
            },
        },
    ],
};

export default enceladus;
