// cspell:words iess
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const titanRadiusKm = 2574.7;

/**
 * Layer sizes are from models fit to Cassini's gravity measurements (Iess et al., 2012), and are
 * rough. Atmosphere values are from the Huygens probe.
 */
const titan: BodyDetails = {
    id: BodyId.Titan,
    description: [
        "Saturn's largest moon, and the only moon with a thick atmosphere. Its orange haze hides the surface from sight.",
        'Under the haze it has rain, rivers, lakes, and seas, of liquid methane and ethane instead of water. A salty water ocean lies deep under its icy crust.',
    ].join('\n\n'),
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 0,
                max: 1980,
            },
            composition: 'Rock, with water bound into it',
            description: 'A large core of rock that holds water in its minerals.',
        },
        {
            id: 'deep-ice',
            name: 'Deep ice',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a8c0d0',
            radiusKm: {
                min: 1980,
                max: titanRadiusKm - 200,
            },
            composition: 'Water ice, squeezed into dense forms',
            description:
                'Ice under so much pressure that its crystals pack tighter than ordinary ice.',
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: titanRadiusKm - 200,
                max: titanRadiusKm - 100,
            },
            composition: 'Salty water, perhaps with ammonia',
            description: "An ocean that lets the crust flex with Saturn's tides.",
        },
        {
            id: 'ice-crust',
            name: 'Ice crust',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#5a4a38',
            radiusKm: {
                min: titanRadiusKm - 100,
                max: titanRadiusKm,
            },
            composition: 'Water ice, under dunes and lakes of organic matter',
            description: 'Ice as hard as rock, carved by methane rain into river valleys.',
            temperatureKelvin: {
                min: 94,
                max: 94,
            },
        },
        {
            id: 'atmosphere',
            name: 'Atmosphere',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#d8a050',
            radiusKm: {
                min: titanRadiusKm,
                max: titanRadiusKm + 600,
            },
            composition: 'Nitrogen, with a few percent methane',
            description:
                "Air denser than Earth's at the ground, topped with an orange haze of molecules that sunlight builds from methane.",
            temperatureKelvin: {
                min: 70,
                max: 180,
            },
            pressureGigapascals: {
                min: 0,
                max: 0.00015,
            },
        },
    ],
};

export default titan;
