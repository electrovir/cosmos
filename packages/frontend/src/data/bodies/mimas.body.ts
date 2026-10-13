// cspell:words lainey
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const mimasRadiusKm = 198.2;

/**
 * The ocean is inferred from the wobble of Mimas' orbit (Lainey et al., 2024). Its depth and the
 * core's size are rough.
 */
const mimas: BodyDetails = {
    id: BodyId.Mimas,
    description: [
        "Saturn's smallest round moon. One crater, Herschel, is a third as wide as Mimas itself, giving it the look of the Death Star.",
        'Wobbles in its orbit suggest a hidden ocean under its ice that formed only within the last 25 million years.',
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
                max: 100,
            },
            composition: 'Rock and ice',
            description: 'A small core of rock and ice.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: 100,
                max: mimasRadiusKm - 25,
            },
            composition: 'Water',
            description: 'A probable young ocean, still growing as tides from Saturn melt it.',
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#b8b4ac',
            radiusKm: {
                min: mimasRadiusKm - 25,
                max: mimasRadiusKm,
            },
            composition: 'Water ice',
            description: 'Ice pocked with craters, with no sign of the ocean below.',
        },
    ],
};

export default mimas;
