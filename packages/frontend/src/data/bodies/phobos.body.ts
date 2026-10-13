// cspell:words regolith stickney
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const phobosRadiusKm = 11.08;

/** Its density is from Mars Express flybys. Its regolith depth is a rough estimate. */
const phobos: BodyDetails = {
    id: BodyId.Phobos,
    description: [
        "The larger of Mars' two small moons, a lumpy rock about 27 kilometers long. It circles Mars three times a day, closer to its planet than any other moon.",
        "Mars' pull is slowly drawing it inward. In 30 to 50 million years it will break apart into a ring or crash into Mars.",
    ].join('\n\n'),
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#5a524a',
            radiusKm: {
                min: 0,
                max: phobosRadiusKm - 0.1,
            },
            composition: 'Rock, loosely packed',
            description:
                'So light for its size that it may be a pile of rubble held together by its own weak gravity.',
        },
        {
            id: 'regolith',
            name: 'Regolith',
            region: LayerRegion.Crust,
            state: MatterState.Solid,
            color: '#6e645a',
            radiusKm: {
                min: phobosRadiusKm - 0.1,
                max: phobosRadiusKm,
            },
            composition: 'Fine dust and broken rock',
            description:
                'A blanket of dust, scarred by the large crater Stickney and long parallel grooves.',
        },
    ],
};

export default phobos;
