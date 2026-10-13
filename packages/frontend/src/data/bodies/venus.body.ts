import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const venusRadiusKm = 6051.8;

/**
 * Atmosphere values are from NASA's Venus fact sheet and the Venus International Reference
 * Atmosphere. No seismometer has worked on Venus long enough to measure its interior, so core and
 * mantle sizes are scaled from Earth's and are rough estimates, as is the core's state.
 */
const venus: BodyDetails = {
    id: BodyId.Venus,
    description: [
        "Nearly Earth's twin in size, but smothered in carbon dioxide air 90 times as heavy as Earth's. Its greenhouse effect makes it the hottest planet, hotter even than Mercury.",
        'It spins backward and so slowly that a day there lasts longer than its year. Its thick clouds of sulfuric acid hide the surface and reflect most sunlight, making it the brightest planet in our sky.',
    ].join('\n\n'),
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#e0a050',
            radiusKm: {
                min: 0,
                max: 3000,
            },
            composition: 'Iron and nickel',
            description:
                "Probably at least partly liquid metal, but unlike Earth's it makes no magnetic field.",
            temperatureKelvin: {
                min: 4500,
                max: 5500,
            },
            densityGramsPerCubicCentimeter: {
                min: 10,
                max: 12,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a85c3e',
            radiusKm: {
                min: 3000,
                max: venusRadiusKm - 30,
            },
            composition: 'Silicate rock',
            description:
                "Hot rock like Earth's mantle. Without plate tectonics to let heat out, it may build up until the whole surface is flooded with lava again.",
            temperatureKelvin: {
                min: 750,
                max: 4500,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.3,
                max: 5.5,
            },
        },
        {
            id: 'crust',
            name: 'Crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#8a6a4e',
            radiusKm: {
                min: venusRadiusKm - 30,
                max: venusRadiusKm,
            },
            composition: 'Basalt',
            description:
                'Volcanic plains, all much the same young age, with thousands of volcanoes and few craters.',
            temperatureKelvin: {
                min: 737,
                max: 750,
            },
            densityGramsPerCubicCentimeter: {
                min: 2.9,
                max: 2.9,
            },
        },
        {
            id: 'lower-atmosphere',
            name: 'Lower atmosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#d9a35a',
            radiusKm: {
                min: venusRadiusKm,
                max: venusRadiusKm + 48,
            },
            composition: 'Carbon dioxide, with some nitrogen',
            description:
                'So dense at the bottom that it acts more like a sea than air. The heat is the same day and night, pole to equator.',
            temperatureKelvin: {
                min: 350,
                max: 737,
            },
            pressureGigapascals: {
                min: 0.0001,
                max: 0.0092,
            },
        },
        {
            id: 'clouds',
            name: 'Clouds',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#f0deb0',
            radiusKm: {
                min: venusRadiusKm + 48,
                max: venusRadiusKm + 70,
            },
            composition: 'Carbon dioxide, with droplets of sulfuric acid',
            description:
                'A deck of acid clouds that wraps the whole planet. Its top races around in four days, much faster than the planet turns.',
            temperatureKelvin: {
                min: 230,
                max: 350,
            },
        },
        {
            id: 'upper-atmosphere',
            name: 'Upper atmosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#b8b0c8',
            radiusKm: {
                min: venusRadiusKm + 70,
                max: venusRadiusKm + 250,
            },
            composition: 'Carbon dioxide, with oxygen and carbon monoxide',
            description: 'Thin air above the clouds, cold on the night side and warmer by day.',
            temperatureKelvin: {
                min: 100,
                max: 300,
            },
        },
    ],
};

export default venus;
