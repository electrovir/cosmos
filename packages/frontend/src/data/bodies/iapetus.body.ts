import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const iapetusRadiusKm = 734.5;

const iapetus: BodyDetails = {
    id: BodyId.Iapetus,
    description: [
        'A two-toned moon. One side is as dark as coal and the other as bright as snow.',
        'A ridge up to 20 kilometers high runs along much of its equator, giving it the shape of a walnut.',
    ].join('\n\n'),
    layers: [
        {
            id: 'interior',
            name: 'Interior',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#9a9080',
            radiusKm: {
                min: 0,
                max: iapetusRadiusKm,
            },
            composition: 'Ice, with some rock',
            description:
                'Mostly ice. The dark coating on its leading side is only a thin layer of dust.',
        },
    ],
};

export default iapetus;
