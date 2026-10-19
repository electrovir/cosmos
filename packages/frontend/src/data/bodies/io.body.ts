// cspell:words anderson
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const ioRadiusKm = 1821.6;

/**
 * Layer sizes are from models fit to Galileo's gravity measurements (Anderson et al., 2001), which
 * allow a range of core sizes.
 */
const io: BodyDetails = {
    id: BodyId.Io,
    description: [
        'The most volcanic world known, with hundreds of active volcanoes. Some throw plumes of sulfur hundreds of kilometers high.',
        "Europa and Ganymede keep its orbit slightly stretched, so Jupiter's pull squeezes it harder and softer through each orbit. That flexing heats its insides.",
    ].join('\n\n'),
    massKg: 8.9319e22,
    meanTemperatureKelvin: 110,
    discovery: {
        year: 1610,
        discoverer: 'Galileo Galilei',
    },
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#c8a070',
            radiusKm: {
                min: 0,
                max: 800,
            },
            composition: 'Iron and iron sulfide',
            description: 'Metal that may be molten, though Io makes no magnetic field of its own.',
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a0603a',
            radiusKm: {
                min: 800,
                max: ioRadiusKm - 40,
            },
            composition: 'Silicate rock',
            description:
                'Rock heated by tidal flexing. Its top may be partly molten, feeding the volcanoes.',
        },
        {
            id: 'crust',
            name: 'Crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#e0c860',
            radiusKm: {
                min: ioRadiusKm - 40,
                max: ioRadiusKm,
            },
            composition: 'Silicate rock, coated in sulfur and frozen sulfur dioxide',
            description: 'Repaved by lava so often that no impact craters have been found on it.',
        },
    ],
};

export default io;
