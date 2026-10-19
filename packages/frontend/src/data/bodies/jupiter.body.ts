// cspell:words wahl
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const jupiterRadiusKm = 69_911;

/**
 * Juno found a dilute core that blends into the hydrogen around it (Wahl et al., 2017), so the core
 * and metallic hydrogen boundaries here are rough. The radius is where the pressure is 1 bar, as
 * for all the gas giants. Atmosphere values are from NASA's Jupiter fact sheet and the Galileo
 * probe.
 */
const jupiter: BodyDetails = {
    id: BodyId.Jupiter,
    description: [
        'The biggest planet, more than twice as massive as all the others put together. It has no solid surface: its gas just gets denser and hotter the deeper it goes.',
        'Its stripes are bands of clouds blown in opposite directions by fast winds. The Great Red Spot is a storm wider than Earth that has raged for centuries.',
    ].join('\n\n'),
    massKg: 1.89813e27,
    meanTemperatureKelvin: 165,
    atmosphereGases: [
        {
            gas: 'H₂',
            percent: 89.8,
        },
        {
            gas: 'He',
            percent: 10.2,
        },
    ],
    layers: [
        {
            id: 'dilute-core',
            name: 'Dilute core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#c47a4a',
            radiusKm: {
                min: 0,
                max: 21_000,
            },
            composition: 'Rock and ice dissolved in metallic hydrogen',
            description:
                'Heavy elements spread through the inner third of the planet instead of packed into a ball, perhaps stirred up by a giant collision.',
            temperatureKelvin: {
                min: 15_000,
                max: 20_000,
            },
            pressureGigapascals: {
                min: 1500,
                max: 4000,
            },
        },
        {
            id: 'metallic-hydrogen',
            name: 'Metallic hydrogen',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#8a8fa8',
            radiusKm: {
                min: 21_000,
                max: 55_000,
            },
            composition: 'Hydrogen and helium',
            description:
                'Hydrogen squeezed so hard it conducts electricity like a liquid metal. Its churning makes the strongest planetary magnetic field in the Solar System.',
            temperatureKelvin: {
                min: 6000,
                max: 15_000,
            },
            pressureGigapascals: {
                min: 200,
                max: 1500,
            },
        },
        {
            id: 'molecular-hydrogen',
            name: 'Molecular hydrogen',
            region: LayerRegion.Interior,
            state: MatterState.Gas,
            color: '#d8b98c',
            radiusKm: {
                min: 55_000,
                max: jupiterRadiusKm,
            },
            composition: 'Hydrogen and helium',
            description:
                'Gas that gets so dense with depth it slowly turns into a hot fluid, with no surface in between. Helium rain may fall through it.',
            temperatureKelvin: {
                min: 165,
                max: 6000,
            },
            pressureGigapascals: {
                min: 0.0001,
                max: 200,
            },
        },
        {
            id: 'troposphere',
            name: 'Troposphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#e8d4b0',
            radiusKm: {
                min: jupiterRadiusKm,
                max: jupiterRadiusKm + 50,
            },
            composition: 'Hydrogen and helium, with clouds of ammonia ice',
            description:
                'Where the weather is: colored cloud bands, lightning, and storms like the Great Red Spot.',
            temperatureKelvin: {
                min: 110,
                max: 165,
            },
        },
        {
            id: 'stratosphere',
            name: 'Stratosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#c8b8d0',
            radiusKm: {
                min: jupiterRadiusKm + 50,
                max: jupiterRadiusKm + 320,
            },
            composition: 'Hydrogen and helium, with a haze of hydrocarbons',
            description: 'A hazy layer that warms with height as it soaks up sunlight.',
            temperatureKelvin: {
                min: 110,
                max: 200,
            },
        },
        {
            id: 'thermosphere',
            name: 'Thermosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#a8b4e0',
            radiusKm: {
                min: jupiterRadiusKm + 320,
                max: jupiterRadiusKm + 1000,
            },
            composition: 'Hydrogen',
            description:
                'Very thin air, heated far beyond what sunlight explains. Huge auroras glow here around both poles.',
            temperatureKelvin: {
                min: 200,
                max: 1000,
            },
        },
    ],
};

export default jupiter;
