// cspell:words cassini mankovich
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const saturnRadiusKm = 58_232;

/**
 * Ring seismology from Cassini shows a dilute core that blends into the hydrogen around it
 * (Mankovich and Fuller, 2021), so layer boundaries are rough. Atmosphere values are from NASA's
 * Saturn fact sheet.
 */
const saturn: BodyDetails = {
    id: BodyId.Saturn,
    description: [
        'The second biggest planet, and the least dense: it would float in a big enough bathtub. Its fast spin flattens it so much that it bulges noticeably at the equator.',
        'Its bright rings are billions of chunks of water ice, from grains of dust to boulders the size of houses. They span almost the distance from Earth to the Moon, yet are mostly only about ten meters thick.',
    ].join('\n\n'),
    layers: [
        {
            id: 'dilute-core',
            name: 'Dilute core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#c47a4a',
            radiusKm: {
                min: 0,
                max: 17_000,
            },
            composition: 'Rock and ice dissolved in metallic hydrogen',
            description:
                'Heavy elements mixed into hydrogen, thinning out gradually with height instead of ending at a sharp edge.',
            temperatureKelvin: {
                min: 10_000,
                max: 12_000,
            },
        },
        {
            id: 'metallic-hydrogen',
            name: 'Metallic hydrogen',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#8a8fa8',
            radiusKm: {
                min: 17_000,
                max: 29_000,
            },
            composition: 'Hydrogen and helium',
            description:
                'Hydrogen squeezed into a liquid metal, which makes the magnetic field. The field lines up with the spin axis almost exactly, which no one can yet explain.',
            temperatureKelvin: {
                min: 6000,
                max: 10_000,
            },
        },
        {
            id: 'molecular-hydrogen',
            name: 'Molecular hydrogen',
            region: LayerRegion.Interior,
            state: MatterState.Gas,
            color: '#e3cf9a',
            radiusKm: {
                min: 29_000,
                max: saturnRadiusKm,
            },
            composition: 'Hydrogen and helium',
            description:
                'Gas that gets denser and hotter with depth until it turns into fluid. Helium raining out of it keeps Saturn warmer than it should be.',
            temperatureKelvin: {
                min: 134,
                max: 6000,
            },
        },
        {
            id: 'troposphere',
            name: 'Troposphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#efe0b8',
            radiusKm: {
                min: saturnRadiusKm,
                max: saturnRadiusKm + 150,
            },
            composition: 'Hydrogen and helium, with clouds of ammonia ice',
            description:
                "Bands of clouds like Jupiter's, but muted by haze. A six-sided jet stream circles the north pole.",
            temperatureKelvin: {
                min: 85,
                max: 134,
            },
        },
        {
            id: 'stratosphere',
            name: 'Stratosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#c8b8d0',
            radiusKm: {
                min: saturnRadiusKm + 150,
                max: saturnRadiusKm + 500,
            },
            composition: 'Hydrogen and helium, with a haze of hydrocarbons',
            description: 'A hazy layer that warms with height as it soaks up sunlight.',
            temperatureKelvin: {
                min: 85,
                max: 150,
            },
        },
        {
            id: 'thermosphere',
            name: 'Thermosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#a8b4e0',
            radiusKm: {
                min: saturnRadiusKm + 500,
                max: saturnRadiusKm + 2500,
            },
            composition: 'Hydrogen',
            description: 'Very thin, hot air where auroras glow around the poles.',
            temperatureKelvin: {
                min: 150,
                max: 600,
            },
        },
    ],
};

export default saturn;
