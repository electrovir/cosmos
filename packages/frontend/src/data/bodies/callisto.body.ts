// cspell:words anderson
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const callistoRadiusKm = 2410.3;

/**
 * Layer sizes are from models fit to Galileo's gravity measurements (Anderson et al., 2001).
 * Whether the ocean exists is uncertain.
 */
const callisto: BodyDetails = {
    id: BodyId.Callisto,
    description: [
        'The most heavily cratered world in the Solar System. Its dark icy surface has barely changed in four billion years.',
        "Unlike Ganymede, its rock and ice never fully separated. The way it disturbs Jupiter's magnetic field hints at a salty ocean deep under the ice.",
    ].join('\n\n'),
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#7a6a5a',
            radiusKm: {
                min: 0,
                max: callistoRadiusKm - 250,
            },
            composition: 'Rock and ice, mixed',
            description: 'Rock and ice that only partly settled apart.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: callistoRadiusKm - 250,
                max: callistoRadiusKm - 150,
            },
            composition: 'Salty water',
            description: 'A possible ocean, kept liquid by salts and the weight of the ice above.',
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#6a5e52',
            radiusKm: {
                min: callistoRadiusKm - 150,
                max: callistoRadiusKm,
            },
            composition: 'Water ice, with dark dust',
            description:
                'Ice crowded with craters, coated in dark dust left as frost slowly evaporates.',
        },
    ],
};

export default callisto;
