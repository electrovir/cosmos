import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const neptuneRadiusKm = 24_622;

/**
 * Interior sizes are from standard three-layer models fit to Voyager 2's gravity measurements, and
 * are rough. Atmosphere values are from Voyager 2 and NASA's Neptune fact sheet.
 */
const neptune: BodyDetails = {
    id: BodyId.Neptune,
    description: [
        'The farthest planet, an ice giant found by math before anyone saw it: its pull was tugging Uranus off course.',
        'Methane gives it a deep blue color. It has the fastest winds in the Solar System, over 2,000 km/h, and dark storms the size of Earth.',
    ].join('\n\n'),
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
            description: 'A rocky center about as massive as Earth.',
            temperatureKelvin: {
                min: 5400,
                max: 7000,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#2a5a9a',
            radiusKm: {
                min: 5000,
                max: 18_500,
            },
            composition: 'Water, ammonia, and methane',
            description:
                'A hot, dense fluid called "ices". Deep down, the pressure may squeeze carbon from methane into diamonds.',
            temperatureKelvin: {
                min: 2000,
                max: 5400,
            },
        },
        {
            id: 'envelope',
            name: 'Envelope',
            region: LayerRegion.Interior,
            state: MatterState.Gas,
            color: '#4a6fd8',
            radiusKm: {
                min: 18_500,
                max: neptuneRadiusKm,
            },
            composition: 'Hydrogen and helium, with methane',
            description: 'Gas that thickens with depth until it blends into the mantle below.',
            temperatureKelvin: {
                min: 72,
                max: 2000,
            },
        },
        {
            id: 'troposphere',
            name: 'Troposphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#7a9ae8',
            radiusKm: {
                min: neptuneRadiusKm,
                max: neptuneRadiusKm + 50,
            },
            composition: 'Hydrogen and helium, with clouds of methane ice',
            description:
                'Wild weather driven by heat from inside the planet, which gives off more than twice the energy it gets from the Sun.',
            temperatureKelvin: {
                min: 55,
                max: 72,
            },
        },
        {
            id: 'stratosphere',
            name: 'Stratosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#a8b8e0',
            radiusKm: {
                min: neptuneRadiusKm + 50,
                max: neptuneRadiusKm + 2000,
            },
            composition: 'Hydrogen and helium, with a haze of hydrocarbons',
            description: 'A thin, hazy layer that warms with height.',
            temperatureKelvin: {
                min: 55,
                max: 750,
            },
        },
    ],
};

export default neptune;
