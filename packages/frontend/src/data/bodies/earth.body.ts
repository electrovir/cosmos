// cspell:words bridgmanite ferropericlase ringwoodite wadsleyite
import {earthMassKg} from '../body-catalog.js';
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';
import {CrustBoundary} from '../earth/earth-data-files.js';

const earthRadiusKm = 6371;

/**
 * Interior boundaries, densities, and pressures are from the Preliminary Reference Earth Model
 * (PREM). Deep temperatures are rough estimates: nobody has measured them, and published estimates
 * differ by hundreds of kelvin.
 */
const earth: BodyDetails = {
    id: BodyId.Earth,
    description:
        'The only planet known to have life. Its liquid outer core makes a magnetic field that shields the atmosphere from the solar wind.',
    massKg: earthMassKg,
    meanTemperatureKelvin: 288,
    atmosphereGases: [
        {
            gas: 'N₂',
            percent: 78.08,
        },
        {
            gas: 'O₂',
            percent: 20.95,
        },
        {
            gas: 'Ar',
            percent: 0.93,
        },
    ],
    surfacePressureBar: 1.014,
    layers: [
        {
            id: 'inner-core',
            name: 'Inner core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#fff1b0',
            radiusKm: {
                min: 0,
                max: 1221.5,
            },
            composition: 'Iron and nickel',
            description:
                'A ball of metal nearly as hot as the surface of the Sun, kept solid by the crushing pressure above it. It grows slowly as the outer core freezes onto it.',
            temperatureKelvin: {
                min: 5400,
                max: 6000,
            },
            densityGramsPerCubicCentimeter: {
                min: 12.76,
                max: 13.09,
            },
            pressureGigapascals: {
                min: 329,
                max: 364,
            },
        },
        {
            id: 'outer-core',
            name: 'Outer core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#ffad42',
            radiusKm: {
                min: 1221.5,
                max: 3480,
            },
            composition: 'Liquid iron and nickel, with some sulfur, oxygen, and silicon',
            description:
                "Churning liquid metal. Its flow acts like a dynamo and makes Earth's magnetic field.",
            temperatureKelvin: {
                min: 4000,
                max: 5400,
            },
            densityGramsPerCubicCentimeter: {
                min: 9.9,
                max: 12.17,
            },
            pressureGigapascals: {
                min: 136,
                max: 329,
            },
        },
        {
            id: 'lower-mantle',
            name: 'Lower mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#e2643a',
            radiusKm: {
                min: 3480,
                max: earthRadiusKm - 660,
            },
            composition: 'Bridgmanite and ferropericlase',
            description:
                "Most of Earth's volume. Solid rock that still creeps a few centimeters a year, carrying heat up from the core.",
            temperatureKelvin: {
                min: 1900,
                max: 4000,
            },
            densityGramsPerCubicCentimeter: {
                min: 4.38,
                max: 5.57,
            },
            pressureGigapascals: {
                min: 23.8,
                max: 136,
            },
        },
        {
            id: 'transition-zone',
            name: 'Transition zone',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#c9502f',
            radiusKm: {
                min: earthRadiusKm - 660,
                max: earthRadiusKm - 410,
            },
            composition: 'Wadsleyite and ringwoodite, squeezed forms of olivine',
            description:
                "Where pressure packs the upper mantle's minerals into denser crystals. Those crystals can hold water, maybe more than all the oceans.",
            temperatureKelvin: {
                min: 1700,
                max: 1900,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.72,
                max: 3.99,
            },
            pressureGigapascals: {
                min: 13.4,
                max: 23.8,
            },
        },
        {
            id: 'upper-mantle',
            name: 'Upper mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a73f2a',
            radiusKm: {
                min: earthRadiusKm - 410,
                max: earthRadiusKm - 24.4,
            },
            composition: 'Peridotite: olivine, pyroxene, and garnet',
            description:
                'Its top is welded to the crust as the rigid tectonic plates. Below that, hot soft rock lets the plates slide.',
            temperatureKelvin: {
                min: 700,
                max: 1700,
            },
            densityGramsPerCubicCentimeter: {
                min: 3.38,
                max: 3.54,
            },
            pressureGigapascals: {
                min: 0.3,
                max: 13.4,
            },
        },
        {
            id: 'lower-crust',
            name: 'Lower crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#6d5547',
            radiusKm: {
                min: earthRadiusKm - 24.4,
                max: earthRadiusKm - 15,
            },
            composition: 'Gabbro and granulite',
            description:
                'Dense, dark rock at the base of the crust. Its bottom, the Moho, is where the mantle starts.',
            densityGramsPerCubicCentimeter: {
                min: 2.9,
                max: 3.1,
            },
        },
        {
            id: 'middle-crust',
            name: 'Middle crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#86695a',
            radiusKm: {
                min: earthRadiusKm - 15,
                max: earthRadiusKm - 8,
            },
            composition: 'Metamorphic rock such as gneiss and amphibolite',
            description: 'Rock that heat and pressure have changed without melting it.',
            densityGramsPerCubicCentimeter: {
                min: 2.7,
                max: 2.9,
            },
        },
        {
            id: 'upper-crust',
            name: 'Upper crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#a08572',
            radiusKm: {
                min: earthRadiusKm - 8,
                max: earthRadiusKm - 1,
            },
            composition: 'Granite on the continents, basalt under the oceans',
            description:
                'The rock under our feet. Continental crust is thick and light and floats high. Ocean crust is thin and heavy and sinks back into the mantle.',
            densityGramsPerCubicCentimeter: {
                min: 2.6,
                max: 2.9,
            },
        },
        {
            id: 'sediments',
            name: 'Sediments',
            isHiddenInCut: true,
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#c9b48a',
            radiusKm: {
                min: earthRadiusKm - 1,
                max: earthRadiusKm - 0.5,
            },
            composition: 'Sand, mud, clay, and limestone',
            description:
                'Layers of grains and shells that settled out of water and wind, piling up kilometers deep in ocean basins.',
            densityGramsPerCubicCentimeter: {
                min: 2,
                max: 2.6,
            },
        },
        {
            id: 'ice',
            name: 'Ice sheets',
            isHiddenInCut: true,
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#e6f3ff',
            radiusKm: {
                min: earthRadiusKm - 0.5,
                max: earthRadiusKm,
            },
            composition: 'Frozen fresh water',
            description:
                "Antarctica and Greenland's ice, more than 4 km thick in places. Melting all of it would raise the seas by about 65 meters.",
            densityGramsPerCubicCentimeter: {
                min: 0.92,
                max: 0.92,
            },
        },
        {
            id: 'ocean',
            name: 'Ocean',
            isHiddenInCut: true,
            region: LayerRegion.Crust,
            state: MatterState.Liquid,
            color: '#1d5d9c',
            radiusKm: {
                min: earthRadiusKm - 3.7,
                max: earthRadiusKm,
            },
            composition: 'Salt water',
            description:
                'Covers 71% of the surface, 3.7 km deep on average and almost 11 km at its deepest.',
            temperatureKelvin: {
                min: 271,
                max: 305,
            },
            densityGramsPerCubicCentimeter: {
                min: 1.02,
                max: 1.05,
            },
        },
        {
            id: 'troposphere',
            name: 'Troposphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#8fcbff',
            radiusKm: {
                min: earthRadiusKm,
                max: earthRadiusKm + 12,
            },
            composition: 'Nitrogen (78%), oxygen (21%), argon (0.9%), and water vapor',
            description:
                'Where all weather happens. It holds about three quarters of the air, and gets colder with height. Its top is lower at the poles and higher at the equator.',
            temperatureKelvin: {
                min: 217,
                max: 288,
            },
        },
        {
            id: 'stratosphere',
            name: 'Stratosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#5f9be2',
            radiusKm: {
                min: earthRadiusKm + 12,
                max: earthRadiusKm + 50,
            },
            composition: 'Dry air with the ozone layer',
            description:
                'The ozone layer soaks up ultraviolet light, which warms this layer from the top. Calm air that long flights cruise in near its bottom.',
            temperatureKelvin: {
                min: 217,
                max: 271,
            },
        },
        {
            id: 'mesosphere',
            name: 'Mesosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#3e6bc4',
            radiusKm: {
                min: earthRadiusKm + 50,
                max: earthRadiusKm + 85,
            },
            composition: 'Thin air',
            description: 'The coldest place on Earth. Most meteors burn up here as shooting stars.',
            temperatureKelvin: {
                min: 180,
                max: 271,
            },
        },
        {
            id: 'thermosphere',
            name: 'Thermosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Plasma,
            color: '#2f3f9a',
            radiusKm: {
                min: earthRadiusKm + 85,
                max: earthRadiusKm + 600,
            },
            composition: 'Atomic oxygen, nitrogen, and their ions',
            description:
                "Sunlight heats its few atoms to over a thousand kelvin, though it would still feel cold. Home of the aurora and the International Space Station. Its top rises and falls with the Sun's activity.",
            temperatureKelvin: {
                min: 180,
                max: 2000,
            },
        },
        {
            id: 'exosphere',
            name: 'Exosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#1d2160',
            radiusKm: {
                min: earthRadiusKm + 600,
                max: earthRadiusKm + 10_000,
            },
            composition: 'Hydrogen and helium',
            description:
                'So thin that atoms rarely hit each other. The fastest ones escape to space.',
        },
    ],
    magneticDipole: {
        /** The geomagnetic north pole for 2025 from NOAA's World Magnetic Model (WMM2025). */
        northPole: {
            latitudeDegrees: 80.79,
            longitudeDegrees: -72.76,
        },
        equatorialSurfaceFieldNanotesla: 29_700,
    },
    /**
     * Draws the 100 km above and below sea level ten times thicker, so mountains, ocean trenches,
     * the crust, and the lower atmosphere show up. The core and mantle shrink to make room, and the
     * rest of the atmosphere eases back to true scale.
     */
    exaggeratedRadialScale: [
        {
            realKm: 0,
            displayKm: 0,
        },
        {
            realKm: earthRadiusKm - 100,
            displayKm: earthRadiusKm - 1000,
        },
        {
            realKm: earthRadiusKm + 100,
            displayKm: earthRadiusKm + 1000,
        },
        {
            realKm: earthRadiusKm + 600,
            displayKm: earthRadiusKm + 1500,
        },
        {
            realKm: earthRadiusKm + 10_000,
            displayKm: earthRadiusKm + 10_000,
        },
    ],
    crust: {
        layerIdsByBoundary: {
            [CrustBoundary.WaterBottom]: 'ocean',
            [CrustBoundary.IceBottom]: 'ice',
            [CrustBoundary.SedimentBottom]: 'sediments',
            [CrustBoundary.UpperCrustBottom]: 'upper-crust',
            [CrustBoundary.MiddleCrustBottom]: 'middle-crust',
            [CrustBoundary.Moho]: 'lower-crust',
        },
    },
};

export default earth;
