// cspell:words anorthosite moonquakes olivine pyroxene
import {moonRadiusKm} from '../../physics/moon-position.js';
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

/**
 * Core and melt layer sizes are from the Apollo seismic model of Weber et al. (2011), and the crust
 * thickness is GRAIL's average. Deep temperatures are rough estimates.
 */
const moon: BodyDetails = {
    id: BodyId.Moon,
    description:
        "Earth's only natural moon. It always shows Earth the same face, and its pull raises most of Earth's ocean tides.",
    layers: [
        {
            id: 'inner-core',
            name: 'Inner core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#f2e6c4',
            radiusKm: {
                min: 0,
                max: 240,
            },
            composition: 'Iron, with some nickel',
            description: 'A small ball of solid metal, under a fiftieth of the Moon by volume.',
            temperatureKelvin: {
                min: 1600,
                max: 1700,
            },
            densityGramsPerCubicCentimeter: {
                min: 8,
                max: 8,
            },
            pressureGigapascals: {
                min: 4.5,
                max: 4.8,
            },
        },
        {
            id: 'outer-core',
            name: 'Outer core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#e0a050',
            radiusKm: {
                min: 240,
                max: 330,
            },
            composition: 'Liquid iron, with some sulfur',
            description:
                'Liquid metal that once ran a magnetic field, long since faded. Old Moon rocks still carry its imprint.',
            temperatureKelvin: {
                min: 1600,
                max: 1650,
            },
            densityGramsPerCubicCentimeter: {
                min: 5.1,
                max: 5.1,
            },
        },
        {
            id: 'partial-melt',
            name: 'Partial melt',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#c4603a',
            radiusKm: {
                min: 330,
                max: 480,
            },
            composition: 'Silicate rock, partly molten',
            description:
                'Rock hot enough that some of it has melted. It soaks up the shaking from moonquakes.',
            temperatureKelvin: {
                min: 1500,
                max: 1600,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.4,
                max: 3.4,
            },
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 480,
                max: moonRadiusKm - 40,
            },
            composition: 'Olivine and pyroxene',
            description:
                'Most of the Moon. Its lava flooded the big impact basins billions of years ago, making the dark patches seen from Earth.',
            temperatureKelvin: {
                min: 500,
                max: 1500,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.3,
                max: 3.4,
            },
        },
        {
            id: 'crust',
            name: 'Crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#b8b4ac',
            radiusKm: {
                min: moonRadiusKm - 40,
                max: moonRadiusKm,
            },
            composition: 'Anorthosite, under a layer of crushed rock dust',
            description:
                'Light rock that floated to the top of an ocean of magma when the Moon was young. It is thicker on the far side.',
            temperatureKelvin: {
                min: 100,
                max: 390,
            },
            densityGramsPerCubicCentimeter: {
                min: 2.55,
                max: 2.55,
            },
        },
    ],
};

export default moon;
