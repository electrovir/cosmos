// cspell:words kuiper nimmo tholins
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const plutoRadiusKm = 1188.3;

/**
 * Layer sizes are from models fit to New Horizons' measurements of Pluto's size and density (Nimmo
 * et al., 2016). Whether the ocean is still liquid is uncertain.
 */
const pluto: BodyDetails = {
    id: BodyId.Pluto,
    description: [
        'A dwarf planet in the Kuiper Belt, a ring of icy worlds beyond Neptune. It was called the ninth planet until 2006, when astronomers found it was one of many similar bodies.',
        'New Horizons flew past in 2015 and found mountains of water ice and a bright, heart-shaped plain of frozen nitrogen that slowly churns like a lava lamp.',
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
                max: 850,
            },
            composition: 'Rock',
            description: "Rock making up most of Pluto's mass.",
        },
        {
            id: 'ocean',
            name: 'Ocean',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#3a6a9a',
            radiusKm: {
                min: 850,
                max: plutoRadiusKm - 150,
            },
            composition: 'Salty water, perhaps with ammonia',
            description:
                'A probable hidden ocean, kept liquid by heat from the rock below. Its weight may be what tipped the heart-shaped plain to face away from Charon.',
            temperatureKelvin: {
                min: 260,
                max: 273,
            },
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#d8c0a8',
            radiusKm: {
                min: plutoRadiusKm - 150,
                max: plutoRadiusKm,
            },
            composition: 'Water ice, with frozen nitrogen, methane, and carbon monoxide on top',
            description:
                'Water ice as hard as rock at these temperatures, forming mountains. Reddish tholins coat much of it.',
            temperatureKelvin: {
                min: 40,
                max: 260,
            },
        },
        {
            id: 'haze',
            name: 'Haze',
            region: LayerRegion.Atmosphere,
            state: MatterState.Gas,
            color: '#8ab0e0',
            radiusKm: {
                min: plutoRadiusKm,
                max: plutoRadiusKm + 200,
            },
            composition: 'Nitrogen, with methane and carbon monoxide',
            description:
                "Air 100,000 times thinner than Earth's, with layers of blue haze. It freezes onto the ground as Pluto moves away from the Sun.",
            temperatureKelvin: {
                min: 40,
                max: 110,
            },
            pressureGigapascals: {
                min: 0,
                max: 0.000000001,
            },
        },
    ],
};

export default pluto;
