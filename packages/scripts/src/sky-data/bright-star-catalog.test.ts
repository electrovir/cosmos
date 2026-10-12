import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {parseBrightStarCatalog} from './bright-star-catalog.js';

/** Lines copied from the catalog, cut after the B−V color. */
const catalogLines = [
    '   2          BD-01 4525      6128569                       235956.2-010330000503.8-003011 98.33-61.14 6.29  +1.10',
    '  92 NOVA 1572                                     B Cas',
    '2061 58Alp OriBD+07 1055  39801113271 224I   4506  Alp Ori  054945.4+072319055510.3+072425199.79-08.96 0.50  +1.85',
    '7001  3Alp LyrBD+38 3238 172167 67174 699I  11510  Alp Lyr  183333.1+384126183656.3+384701 67.44 19.24 0.03',
];

describe(parseBrightStarCatalog.name, () => {
    const stars = parseBrightStarCatalog(catalogLines.join('\n'));

    it('reads Betelgeuse and skips the nova with no position', () => {
        assert.isLengthExactly(stars, 3);
        assert.deepEquals(stars[1], {
            rightAscensionDegrees: 15 * (5 + 55 / 60 + 10.3 / 3600),
            declinationDegrees: 7 + 24 / 60 + 25 / 3600,
            visualMagnitude: 0.5,
            colorIndex: 1.85,
        });
    });
    it('reads southern declinations and a missing color', () => {
        assert.isBelow(stars[0]?.declinationDegrees ?? 0, 0);
        assert.strictEquals(stars[2]?.colorIndex, 0);
    });
});
