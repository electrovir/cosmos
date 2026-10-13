// cspell:words anderson kivelson
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const ganymedeRadiusKm = 2631.2;

/**
 * Layer sizes are from models fit to Galileo's gravity and magnetic measurements (Anderson et al.,
 * 1996; Kivelson et al., 2002), and are rough.
 */
const ganymede: BodyDetails = {
    id: BodyId.Ganymede,
    description: [
        'The largest moon in the Solar System, bigger than the planet Mercury. It is the only moon known to make its own magnetic field.',
        'Old dark regions and younger bright, grooved terrain cover its icy surface. Deep below is a salty ocean, sandwiched between layers of ice.',
    ].join('\n\n'),
    layers: [
        {
            id: 'core',
            name: 'Core',
            region: LayerRegion.Interior,
            state: MatterState.Liquid,
            color: '#c8a070',
            radiusKm: {
                min: 0,
                max: 650,
            },
            composition: 'Iron and iron sulfide',
            description: 'Molten metal, churning to make its magnetic field.',
        },
        {
            id: 'mantle',
            name: 'Mantle',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#8a6d5a',
            radiusKm: {
                min: 650,
                max: 1350,
            },
            composition: 'Silicate rock',
            description: 'A thick layer of rock around the core.',
        },
        {
            id: 'deep-ice',
            name: 'Deep ice',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#a8c0d0',
            radiusKm: {
                min: 1350,
                max: ganymedeRadiusKm - 250,
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
                min: ganymedeRadiusKm - 250,
                max: ganymedeRadiusKm - 150,
            },
            composition: 'Salty water',
            description:
                "An ocean that rocks Ganymede's magnetic field as Jupiter's field sweeps past.",
            temperatureKelvin: {
                min: 250,
                max: 273,
            },
        },
        {
            id: 'ice-shell',
            name: 'Ice shell',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#9a8c7c',
            radiusKm: {
                min: ganymedeRadiusKm - 150,
                max: ganymedeRadiusKm,
            },
            composition: 'Water ice, with dark dust',
            description:
                'Ice as hard as rock at these temperatures, dusted dark in its oldest regions.',
            temperatureKelvin: {
                min: 90,
                max: 250,
            },
        },
    ],
};

export default ganymede;
