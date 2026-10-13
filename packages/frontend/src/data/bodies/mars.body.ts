// cspell:words marsquakes olivine stähler wieczorek
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const marsRadiusKm = 3389.5;

/**
 * Core size and crust thickness are from InSight's seismometer (Stähler et al., 2021; Wieczorek et
 * al., 2022). Atmosphere values are from NASA's Mars fact sheet. Deep temperatures are rough
 * estimates.
 */
const mars: BodyDetails = {
    id: BodyId.Mars,
    description: [
        'A cold desert planet, red from rusty dust. It has the tallest volcano and the longest canyon in the Solar System.',
        'Dry riverbeds and lake beds show it once had liquid water. Most of what is left is frozen in its polar caps and underground.',
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
                max: 1830,
            },
            composition: 'Liquid iron, with sulfur and lighter elements',
            description:
                'Liquid metal, bigger and lighter than expected. It once made a magnetic field, but that stopped billions of years ago.',
            temperatureKelvin: {
                min: 2000,
                max: 2400,
            },
            densityGramsPerCubicCentimeter: {
                min: 6,
                max: 6.3,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 1830,
                max: marsRadiusKm - 50,
            },
            composition: 'Olivine-rich rock',
            description:
                'Rock that fed giant volcanoes. InSight recorded marsquakes shaking through it.',
            temperatureKelvin: {
                min: 700,
                max: 2000,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.4,
                max: 4,
            },
        },
        {
            id: 'crust',
            name: 'Crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#b5562e',
            radiusKm: {
                min: marsRadiusKm - 50,
                max: marsRadiusKm,
            },
            composition: 'Basalt, under a layer of iron-oxide dust',
            description:
                'Much thicker in the southern highlands than the northern lowlands, which may once have held an ocean.',
            temperatureKelvin: {
                min: 140,
                max: 300,
            },
            densityGramsPerCubicCentimeter: {
                min: 2.6,
                max: 3,
            },
        },
        {
            id: 'lower-atmosphere',
            name: 'Lower atmosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#d9a080',
            radiusKm: {
                min: marsRadiusKm,
                max: marsRadiusKm + 40,
            },
            composition: 'Carbon dioxide, with nitrogen and argon',
            description:
                'Under 1% as dense as Earth air. Dust storms in it can grow to cover the whole planet.',
            temperatureKelvin: {
                min: 170,
                max: 240,
            },
            pressureGigapascals: {
                min: 0.00000002,
                max: 0.0000006,
            },
        },
        {
            id: 'upper-atmosphere',
            name: 'Upper atmosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#a0a8c8',
            radiusKm: {
                min: marsRadiusKm + 40,
                max: marsRadiusKm + 200,
            },
            composition: 'Carbon dioxide, with oxygen',
            description:
                'With no magnetic field to shield it, the solar wind strips this air away into space a little at a time.',
            temperatureKelvin: {
                min: 120,
                max: 270,
            },
        },
    ],
};

export default mars;
