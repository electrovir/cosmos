// cspell:words regolith
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const deimosRadiusKm = 6.27;

/** Its regolith depth is a rough estimate. */
const deimos: BodyDetails = {
    id: BodyId.Deimos,
    description: [
        "The smaller and farther of Mars' two moons, about 15 kilometers long. It takes 30 hours to circle Mars, only a little longer than a Mars day, so it drifts slowly across the Martian sky.",
        "Both of Mars' moons may be asteroids Mars captured, or pieces thrown off by a giant impact on Mars.",
    ].join('\n\n'),
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#6e6458',
            radiusKm: {
                min: 0,
                max: deimosRadiusKm - 0.05,
            },
            composition: 'Rock, loosely packed',
            description: 'Probably rubble, like Phobos.',
        },
        {
            id: 'regolith',
            name: 'Regolith',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#8a7c6c',
            radiusKm: {
                min: deimosRadiusKm - 0.05,
                max: deimosRadiusKm,
            },
            composition: 'Fine dust',
            description: 'Dust that fills in its craters, making it look smoother than Phobos.',
        },
    ],
};

export default deimos;
