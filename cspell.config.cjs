const {baseConfig} = require('@virmator/spellcheck/configs/cspell.config.base.cjs');

module.exports = {
    ...baseConfig,
    ignorePaths: [
        ...baseConfig.ignorePaths,
    ],
    words: [
        ...baseConfig.words,
        'Cassini',
        'equirectangular',
        'ETOPO',
        'glsl',
        'huggingface',
        'hyperlegible',
        'ICRF',
        'Keplerian',
        'kokoro',
        'logdepthbuf',
        'magnetopause',
        'misaki',
        'magnetotail',
        'nanopascals',
        'nanotesla',
        'nanoteslas',
        'NOAA',
        'onnx',
        'onnxruntime',
        'raycaster',
        'WGCCRE',
    ],
};
