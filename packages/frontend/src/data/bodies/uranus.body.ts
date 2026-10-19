import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const uranusRadiusKm = 25_362;

/**
 * Interior sizes are from standard three-layer models fit to Voyager 2's gravity measurements, and
 * are rough. Atmosphere heights are from Voyager 2 and NASA's Uranus fact sheet.
 */
const uranus: BodyDetails = {
    id: BodyId.Uranus,
    description: [
        'An ice giant tipped on its side, perhaps knocked over by a giant collision long ago. Each pole gets 42 years of sunlight, then 42 years of darkness.',
        'Methane in its air soaks up red light, giving it a pale blue-green color. It is the coldest planet, giving off almost no heat of its own.',
    ].join('\n\n'),
    massKg: 8.6811e25,
    meanTemperatureKelvin: 76,
    discovery: {
        year: 1781,
        discoverer: 'William Herschel',
    },
    atmosphereGases: [
        {
            gas: 'H₂',
            percent: 82.5,
        },
        {
            gas: 'He',
            percent: 15.2,
        },
        {
            gas: 'CH₄',
            percent: 2.3,
        },
    ],
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a0704a',
            radiusKm: {
                min: 0,
                max: 5000,
            },
            composition: 'Rock and iron',
            description: 'A rocky center, only about half as massive as Earth.',
            temperatureKelvin: {
                min: 5000,
                max: 5000,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a8a9a',
            radiusKm: {
                min: 5000,
                max: 20_000,
            },
            composition: 'Water, ammonia, and methane',
            description:
                'Called "ices", though it is a hot, dense fluid. Currents in it make a lopsided magnetic field, tilted far from the spin axis.',
            temperatureKelvin: {
                min: 2000,
                max: 5000,
            },
        },
        {
            id: 'envelope',
            name: 'Envelope',
            region: LayerRegion.Interior,
            state: MatterState.Gas,
            color: '#9fd8e0',
            radiusKm: {
                min: 20_000,
                max: uranusRadiusKm,
            },
            composition: 'Hydrogen and helium, with methane',
            description: 'Gas that thickens with depth until it blends into the mantle below.',
            temperatureKelvin: {
                min: 76,
                max: 2000,
            },
        },
        {
            id: 'troposphere',
            name: 'Troposphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#c0e8ec',
            radiusKm: {
                min: uranusRadiusKm,
                max: uranusRadiusKm + 50,
            },
            composition: 'Hydrogen and helium, with clouds of methane ice',
            description:
                'The coldest air of any planet. Its few bright clouds come and go with the seasons.',
            temperatureKelvin: {
                min: 49,
                max: 76,
            },
        },
        {
            id: 'stratosphere',
            name: 'Stratosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#a8c8e0',
            radiusKm: {
                min: uranusRadiusKm + 50,
                max: uranusRadiusKm + 4000,
            },
            composition: 'Hydrogen and helium, with a haze of hydrocarbons',
            description: 'A thin, hazy layer that warms with height.',
            temperatureKelvin: {
                min: 49,
                max: 800,
            },
        },
    ],
};

export default uranus;
