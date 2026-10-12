import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const sunRadiusKm = 695_700;
const photosphereThicknessKm = 500;

/** Values from NASA's Sun fact sheet and standard solar models, rounded. */
const sun: BodyDetails = {
    id: BodyId.Sun,
    description: [
        "An ordinary star that holds 99.8% of the Solar System's mass. It fuses about 600 million tonnes of hydrogen into helium every second.",
        'Sunspots are cooler, darker patches where knots of magnetic field break through the surface. Glowing loops of plasma arch between them along the field lines.',
        'When those fields snap, they release a flare. Some also fling plasma into space as a coronal mass ejection, which can set off auroras on Earth.',
    ].join('\n\n'),
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Plasma,
            color: '#fffbe6',
            radiusKm: {
                min: 0,
                max: sunRadiusKm * 0.25,
            },
            composition: 'Hydrogen and helium',
            description: "Where hydrogen fuses into helium and makes all of the Sun's energy.",
            temperatureKelvin: {
                min: 7_000_000,
                max: 15_700_000,
            },
        },
        {
            id: 'radiative-zone',
            name: 'Radiative zone',
            region: LayerRegion.Interior,
            state: MatterState.Plasma,
            color: '#ffd166',
            radiusKm: {
                min: sunRadiusKm * 0.25,
                max: sunRadiusKm * 0.7,
            },
            composition: 'Hydrogen and helium',
            description:
                'So dense that light from the core bounces around here for over 100,000 years before getting out.',
            temperatureKelvin: {
                min: 2_000_000,
                max: 7_000_000,
            },
        },
        {
            id: 'convective-zone',
            name: 'Convective zone',
            region: LayerRegion.Interior,
            state: MatterState.Plasma,
            color: '#ff9f1c',
            radiusKm: {
                min: sunRadiusKm * 0.7,
                max: sunRadiusKm - photosphereThicknessKm,
            },
            composition: 'Hydrogen and helium',
            description: 'Boiling plasma carries heat up to the surface in huge rising cells.',
            temperatureKelvin: {
                min: 5800,
                max: 2_000_000,
            },
        },
        {
            id: 'photosphere',
            name: 'Photosphere',
            region: LayerRegion.Crust,
            state: MatterState.Plasma,
            color: '#ffe08a',
            radiusKm: {
                min: sunRadiusKm - photosphereThicknessKm,
                max: sunRadiusKm,
            },
            composition: 'Hydrogen and helium',
            description:
                'The visible surface, where the Sun turns see-through and its light escapes. It is tiled with boiling granules, each about the size of Texas, and dotted with dark, cooler sunspots where magnetic fields poke through.',
            temperatureKelvin: {
                min: 4400,
                max: 6600,
            },
        },
        {
            id: 'chromosphere',
            name: 'Chromosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Plasma,
            color: '#ff5d73',
            radiusKm: {
                min: sunRadiusKm,
                max: sunRadiusKm + 2000,
            },
            composition: 'Hydrogen and helium',
            description: 'A thin pink layer above the visible surface, seen during total eclipses.',
            temperatureKelvin: {
                min: 4000,
                max: 25_000,
            },
        },
        {
            id: 'corona',
            name: 'Corona',
            region: LayerRegion.Atmosphere,
            state: MatterState.Plasma,
            color: '#cdd7ff',
            radiusKm: {
                min: sunRadiusKm + 2000,
                max: sunRadiusKm * 10,
            },
            composition: 'Hydrogen and helium ions',
            description: 'Far hotter than the surface below it. It streams away as the solar wind.',
            temperatureKelvin: {
                min: 1_000_000,
                max: 3_000_000,
            },
        },
    ],
};

export default sun;
