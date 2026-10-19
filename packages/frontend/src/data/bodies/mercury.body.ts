// cspell:words hauck padovan
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const mercuryRadiusKm = 2439.7;

/**
 * Core size is from MESSENGER's gravity and spin measurements (Hauck et al., 2013), and the crust
 * thickness is Padovan et al.'s (2017) average. The inner core's size and all deep temperatures are
 * rough estimates.
 */
const mercury: BodyDetails = {
    id: BodyId.Mercury,
    description: [
        'The smallest planet and the closest to the Sun. With almost no air to hold heat, its surface swings from hot enough to melt lead by day to far colder than Antarctica by night.',
        'Its iron core fills most of the planet, so it is nearly as dense as Earth despite being barely bigger than the Moon.',
    ].join('\n\n'),
    massKg: 3.3011e23,
    meanTemperatureKelvin: 440,
    layers: [
        {
            id: 'inner-core',
            name: 'Inner core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#f2e6c4',
            radiusKm: {
                min: 0,
                max: 1000,
            },
            composition: 'Iron and nickel',
            description: 'Solid metal at the very center. How big it is is still uncertain.',
            temperatureKelvin: {
                min: 1900,
                max: 2100,
            },
        },
        {
            id: 'outer-core',
            name: 'Outer core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#e0a050',
            radiusKm: {
                min: 1000,
                max: 2020,
            },
            composition: 'Liquid iron, with sulfur and silicon',
            description:
                'A huge ball of liquid metal, over 80% of the way to the surface. Its churning makes a weak magnetic field.',
            temperatureKelvin: {
                min: 1800,
                max: 1900,
            },
            densityGramsPerCubicCentimeter: {
                min: 6.9,
                max: 7.3,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 2020,
                max: mercuryRadiusKm - 26,
            },
            composition: 'Silicate rock',
            description:
                'A thin shell of rock. It shrank as the planet cooled, wrinkling the crust above into cliffs hundreds of kilometers long.',
            temperatureKelvin: {
                min: 800,
                max: 1800,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.2,
                max: 3.4,
            },
        },
        {
            id: 'crust',
            name: 'Crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#9b928a',
            radiusKm: {
                min: mercuryRadiusKm - 26,
                max: mercuryRadiusKm,
            },
            composition: 'Dark volcanic rock, low in iron and rich in carbon',
            description:
                'Old lava plains covered in craters. Ice hides in craters near the poles that sunlight never reaches.',
            temperatureKelvin: {
                min: 100,
                max: 700,
            },
            densityGramsPerCubicCentimeter: {
                min: 2.8,
                max: 3,
            },
        },
    ],
};

export default mercury;
