// cspell:words chasma ithaca odysseus
import {BodyId, LayerRegion, MatterState, type BodyDetails} from '../celestial-body.js';

const tethysRadiusKm = 531.1;

const tethys: BodyDetails = {
    id: BodyId.Tethys,
    description: [
        'A moon made almost entirely of water ice, barely denser than water.',
        'A huge crater, Odysseus, covers much of one side, and a canyon, Ithaca Chasma, runs three quarters of the way around it.',
    ].join('\n\n'),
    layers: [
        {
            id: 'ice',
            name: 'Ice',
            region: LayerRegion.Interior,
            state: MatterState.Solid,
            color: '#dcdcd8',
            radiusKm: {
                min: 0,
                max: tethysRadiusKm,
            },
            composition: 'Water ice, with a little rock',
            description: 'Almost pure ice, all the way through.',
        },
    ],
};

export default tethys;
