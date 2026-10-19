// cspell:words encke ephemerides
import {moonRadiusKm} from '../physics/moon-position.js';
import {BodyId, BodyKind, type BodyDetails, type BodySummary} from './celestial-body.js';

export const kilometersPerAstronomicalUnit = 149_597_870.7;
export const earthMassKg = 5.9722e24;

/**
 * Every body the app knows about. Orbits are the J2000 elements from Standish's "Keplerian Elements
 * for Approximate Positions of the Major Planets" (Earth's is the Earth-Moon barycenter's), with
 * periods from that table's mean motions. Rotations are from the IAU WGCCRE 2009 report, without
 * the slow drift of the pole or Neptune's wobble. Radii are mean radii. Moon counts are from NASA
 * as of mid-2026.
 *
 * Other than the Moon, moons' orbits are fit to JPL Horizons' ephemerides from late 2026, so
 * they're placed best near then. Each keeps one face toward its planet, so its rotation is derived
 * from its orbit, with longitude 0 facing the planet, which matches the WGCCRE values to within a
 * few degrees.
 */
export const bodyCatalog: Readonly<Record<BodyId, Readonly<BodySummary>>> = {
    [BodyId.Sun]: {
        id: BodyId.Sun,
        name: 'Sun',
        // cspell:disable-next-line
        pronunciation: 'sˈʌn',
        kind: BodyKind.Star,
        radiusKm: 695_700,
        rotation: {
            poleRightAscensionDegrees: 286.13,
            poleDeclinationDegrees: 63.87,
            primeMeridianAtJ2000Degrees: 84.176,
            primeMeridianDegreesPerDay: 14.1844,
        },
    },
    [BodyId.Mercury]: {
        id: BodyId.Mercury,
        name: 'Mercury',
        // cspell:disable-next-line
        pronunciation: 'mˈɜɹkjəɹi',
        kind: BodyKind.Planet,
        radiusKm: 2439.7,
        parentId: BodyId.Sun,
        knownMoonCount: 0,
        orbit: {
            semiMajorAxisKm: 0.38709927 * kilometersPerAstronomicalUnit,
            eccentricity: 0.20563593,
            inclinationDegrees: 7.00497902,
            meanLongitudeAtJ2000Degrees: 252.2503235,
            longitudeOfPerihelionDegrees: 77.45779628,
            longitudeOfAscendingNodeDegrees: 48.33076593,
            periodDays: 87.969,
        },
        rotation: {
            poleRightAscensionDegrees: 281.0097,
            poleDeclinationDegrees: 61.4143,
            primeMeridianAtJ2000Degrees: 329.5469,
            primeMeridianDegreesPerDay: 6.1385025,
        },
    },
    [BodyId.Venus]: {
        id: BodyId.Venus,
        name: 'Venus',
        // cspell:disable-next-line
        pronunciation: 'vˈinəs',
        kind: BodyKind.Planet,
        radiusKm: 6051.8,
        parentId: BodyId.Sun,
        knownMoonCount: 0,
        orbit: {
            semiMajorAxisKm: 0.72333566 * kilometersPerAstronomicalUnit,
            eccentricity: 0.00677672,
            inclinationDegrees: 3.39467605,
            meanLongitudeAtJ2000Degrees: 181.9790995,
            longitudeOfPerihelionDegrees: 131.60246718,
            longitudeOfAscendingNodeDegrees: 76.67984255,
            periodDays: 224.701,
        },
        /** Spins backward, so its prime meridian's angle shrinks. */
        rotation: {
            poleRightAscensionDegrees: 272.76,
            poleDeclinationDegrees: 67.16,
            primeMeridianAtJ2000Degrees: 160.2,
            primeMeridianDegreesPerDay: -1.4813688,
        },
    },
    [BodyId.Earth]: {
        id: BodyId.Earth,
        name: 'Earth',
        // cspell:disable-next-line
        pronunciation: 'ˈɜɹθ',
        kind: BodyKind.Planet,
        radiusKm: 6371,
        parentId: BodyId.Sun,
        knownMoonCount: 1,
        orbit: {
            semiMajorAxisKm: 1.00000261 * kilometersPerAstronomicalUnit,
            eccentricity: 0.01671123,
            inclinationDegrees: -0.00001531,
            meanLongitudeAtJ2000Degrees: 100.46457166,
            longitudeOfPerihelionDegrees: 102.93768193,
            longitudeOfAscendingNodeDegrees: 0,
            periodDays: 365.256363,
        },
        rotation: {
            poleRightAscensionDegrees: 0,
            poleDeclinationDegrees: 90,
            primeMeridianAtJ2000Degrees: 190.147,
            primeMeridianDegreesPerDay: 360.9856235,
        },
    },
    /** Its orbit comes from `getMoonPosition` instead of fixed elements, which drift too fast. */
    [BodyId.Moon]: {
        id: BodyId.Moon,
        name: 'Moon',
        // cspell:disable-next-line
        pronunciation: 'mˈun',
        kind: BodyKind.Moon,
        radiusKm: moonRadiusKm,
        parentId: BodyId.Earth,
        rotation: {
            poleRightAscensionDegrees: 269.9949,
            poleDeclinationDegrees: 66.5392,
            primeMeridianAtJ2000Degrees: 38.3213,
            primeMeridianDegreesPerDay: 13.17635815,
        },
    },
    [BodyId.Mars]: {
        id: BodyId.Mars,
        name: 'Mars',
        // cspell:disable-next-line
        pronunciation: 'mˈɑɹz',
        kind: BodyKind.Planet,
        radiusKm: 3389.5,
        parentId: BodyId.Sun,
        knownMoonCount: 2,
        orbit: {
            semiMajorAxisKm: 1.52371034 * kilometersPerAstronomicalUnit,
            eccentricity: 0.0933941,
            inclinationDegrees: 1.84969142,
            meanLongitudeAtJ2000Degrees: -4.55343205,
            longitudeOfPerihelionDegrees: -23.94362959,
            longitudeOfAscendingNodeDegrees: 49.55953891,
            periodDays: 686.98,
        },
        rotation: {
            poleRightAscensionDegrees: 317.68143,
            poleDeclinationDegrees: 52.8865,
            primeMeridianAtJ2000Degrees: 176.63,
            primeMeridianDegreesPerDay: 350.89198226,
        },
    },
    [BodyId.Phobos]: {
        id: BodyId.Phobos,
        name: 'Phobos',
        // cspell:disable-next-line
        pronunciation: 'fˈObəs',
        kind: BodyKind.Moon,
        radiusKm: 11.08,
        parentId: BodyId.Mars,
        orbit: {
            semiMajorAxisKm: 9379,
            eccentricity: 0.01499,
            inclinationDegrees: 25.6546,
            meanLongitudeAtJ2000Degrees: 257.5046,
            longitudeOfPerihelionDegrees: 357.6331,
            longitudeOfAscendingNodeDegrees: 82.3673,
            periodDays: 0.3189100887,
        },
        rotation: {
            poleRightAscensionDegrees: 316.212,
            poleDeclinationDegrees: 53.53,
            primeMeridianAtJ2000Degrees: 35,
            primeMeridianDegreesPerDay: 1128.844815,
        },
    },
    [BodyId.Deimos]: {
        id: BodyId.Deimos,
        name: 'Deimos',
        // cspell:disable-next-line
        pronunciation: 'dˈImOs',
        kind: BodyKind.Moon,
        radiusKm: 6.27,
        parentId: BodyId.Mars,
        orbit: {
            semiMajorAxisKm: 23_460,
            eccentricity: 0.00032,
            inclinationDegrees: 24.1235,
            meanLongitudeAtJ2000Degrees: 299.8005,
            longitudeOfPerihelionDegrees: 120.8932,
            longitudeOfAscendingNodeDegrees: 81.5217,
            periodDays: 1.262440458,
        },
        rotation: {
            poleRightAscensionDegrees: 314.019,
            poleDeclinationDegrees: 54.428,
            primeMeridianAtJ2000Degrees: 80.84,
            primeMeridianDegreesPerDay: 285.1619636,
        },
    },
    [BodyId.Jupiter]: {
        id: BodyId.Jupiter,
        name: 'Jupiter',
        // cspell:disable-next-line
        pronunciation: 'ʤˈupəɾəɹ',
        kind: BodyKind.Planet,
        radiusKm: 69_911,
        parentId: BodyId.Sun,
        knownMoonCount: 115,
        orbit: {
            semiMajorAxisKm: 5.202887 * kilometersPerAstronomicalUnit,
            eccentricity: 0.04838624,
            inclinationDegrees: 1.30439695,
            meanLongitudeAtJ2000Degrees: 34.39644051,
            longitudeOfPerihelionDegrees: 14.72847983,
            longitudeOfAscendingNodeDegrees: 100.47390909,
            periodDays: 4332.82,
        },
        rotation: {
            poleRightAscensionDegrees: 268.056595,
            poleDeclinationDegrees: 64.495303,
            primeMeridianAtJ2000Degrees: 284.95,
            primeMeridianDegreesPerDay: 870.536,
        },
    },
    [BodyId.Io]: {
        id: BodyId.Io,
        name: 'Io',
        // cspell:disable-next-line
        pronunciation: 'ˈIO',
        kind: BodyKind.Moon,
        radiusKm: 1821.6,
        parentId: BodyId.Jupiter,
        orbit: {
            semiMajorAxisKm: 422_032,
            eccentricity: 0.00453,
            inclinationDegrees: 2.2272,
            meanLongitudeAtJ2000Degrees: 18.1161,
            longitudeOfPerihelionDegrees: 29.0855,
            longitudeOfAscendingNodeDegrees: 338.4117,
            periodDays: 1.769137708,
        },
        rotation: {
            poleRightAscensionDegrees: 268.098,
            poleDeclinationDegrees: 64.477,
            primeMeridianAtJ2000Degrees: 199.75,
            primeMeridianDegreesPerDay: 203.4889644,
        },
    },
    [BodyId.Europa]: {
        id: BodyId.Europa,
        name: 'Europa',
        // cspell:disable-next-line
        pronunciation: 'jʊɹˈOpə',
        kind: BodyKind.Moon,
        radiusKm: 1560.8,
        parentId: BodyId.Jupiter,
        orbit: {
            semiMajorAxisKm: 671_172,
            eccentricity: 0.00941,
            inclinationDegrees: 2.0793,
            meanLongitudeAtJ2000Degrees: 211.8236,
            longitudeOfPerihelionDegrees: 203.8458,
            longitudeOfAscendingNodeDegrees: 326.19,
            periodDays: 3.551178061,
        },
        rotation: {
            poleRightAscensionDegrees: 267.281,
            poleDeclinationDegrees: 64.808,
            primeMeridianAtJ2000Degrees: 34.45,
            primeMeridianDegreesPerDay: 101.3748097,
        },
    },
    [BodyId.Ganymede]: {
        id: BodyId.Ganymede,
        name: 'Ganymede',
        // cspell:disable-next-line
        pronunciation: 'ɡˈænəmˌid',
        kind: BodyKind.Moon,
        radiusKm: 2631.2,
        parentId: BodyId.Jupiter,
        orbit: {
            semiMajorAxisKm: 1_070_669,
            eccentricity: 0.00276,
            inclinationDegrees: 2.3434,
            meanLongitudeAtJ2000Degrees: 220.2471,
            longitudeOfPerihelionDegrees: 355.9492,
            longitudeOfAscendingNodeDegrees: 339.0712,
            periodDays: 7.154556481,
        },
        rotation: {
            poleRightAscensionDegrees: 268.066,
            poleDeclinationDegrees: 64.359,
            primeMeridianAtJ2000Degrees: 41.79,
            primeMeridianDegreesPerDay: 50.31758446,
        },
    },
    [BodyId.Callisto]: {
        id: BodyId.Callisto,
        name: 'Callisto',
        // cspell:disable-next-line
        pronunciation: 'kəlˈɪstO',
        kind: BodyKind.Moon,
        radiusKm: 2410.3,
        parentId: BodyId.Jupiter,
        orbit: {
            semiMajorAxisKm: 1_882_412,
            eccentricity: 0.00729,
            inclinationDegrees: 1.9524,
            meanLongitudeAtJ2000Degrees: 78.5646,
            longitudeOfPerihelionDegrees: 11.0964,
            longitudeOfAscendingNodeDegrees: 336.744,
            periodDays: 16.68896943,
        },
        rotation: {
            poleRightAscensionDegrees: 268.192,
            poleDeclinationDegrees: 64.756,
            primeMeridianAtJ2000Degrees: 260.99,
            primeMeridianDegreesPerDay: 21.57113425,
        },
    },
    /**
     * Ring and gap edges are from Cassini and Voyager measurements. Opacities and colors are rough,
     * matched by eye to Cassini photos.
     */
    [BodyId.Saturn]: {
        id: BodyId.Saturn,
        name: 'Saturn',
        // cspell:disable-next-line
        pronunciation: 'sˈæɾəɹn',
        kind: BodyKind.Planet,
        radiusKm: 58_232,
        parentId: BodyId.Sun,
        knownMoonCount: 293,
        orbit: {
            semiMajorAxisKm: 9.53667594 * kilometersPerAstronomicalUnit,
            eccentricity: 0.05386179,
            inclinationDegrees: 2.48599187,
            meanLongitudeAtJ2000Degrees: 49.95424423,
            longitudeOfPerihelionDegrees: 92.59887831,
            longitudeOfAscendingNodeDegrees: 113.66242448,
            periodDays: 10_755.88,
        },
        rotation: {
            poleRightAscensionDegrees: 40.589,
            poleDeclinationDegrees: 83.537,
            primeMeridianAtJ2000Degrees: 38.9,
            primeMeridianDegreesPerDay: 810.7939024,
        },
        rings: [
            {
                radiusKm: {
                    min: 66_900,
                    max: 74_510,
                },
                color: '#6e6660',
                opacity: 0.03,
            },
            /** The C ring, faint and gray. */
            {
                radiusKm: {
                    min: 74_658,
                    max: 77_800,
                },
                color: '#857b72',
                opacity: 0.1,
                ringletContrast: 0.3,
            },
            {
                radiusKm: {
                    min: 77_950,
                    max: 84_750,
                },
                color: '#857b72',
                opacity: 0.12,
                outerOpacity: 0.18,
                ringletContrast: 0.4,
            },
            /** The C ring's plateaus, brighter strips with darker ones between. */
            {
                radiusKm: {
                    min: 84_750,
                    max: 87_340,
                },
                color: '#9a8f82',
                opacity: 0.25,
                ringletContrast: 0.8,
            },
            /** The Maxwell ringlet, alone in the Maxwell Gap. */
            {
                radiusKm: {
                    min: 87_460,
                    max: 87_520,
                },
                color: '#a89c8c',
                opacity: 0.4,
            },
            {
                radiusKm: {
                    min: 87_610,
                    max: 92_000,
                },
                color: '#948a7e',
                opacity: 0.2,
                ringletContrast: 0.7,
            },
            /** The B ring, the brightest and densest. */
            {
                radiusKm: {
                    min: 92_000,
                    max: 99_000,
                },
                color: '#d8ccb0',
                opacity: 0.75,
                outerOpacity: 0.85,
                ringletContrast: 0.3,
            },
            {
                radiusKm: {
                    min: 99_000,
                    max: 115_000,
                },
                color: '#ece0c4',
                opacity: 0.97,
                ringletContrast: 0.15,
            },
            {
                radiusKm: {
                    min: 115_000,
                    max: 117_580,
                },
                color: '#e0d4b8',
                opacity: 0.9,
                ringletContrast: 0.3,
            },
            /** The Cassini Division starts with the Huygens Gap and its ringlet. */
            {
                radiusKm: {
                    min: 117_810,
                    max: 117_880,
                },
                color: '#c8bca4',
                opacity: 0.5,
            },
            {
                radiusKm: {
                    min: 117_880,
                    max: 118_183,
                },
                color: '#7a7268',
                opacity: 0.06,
            },
            {
                radiusKm: {
                    min: 118_285,
                    max: 119_729,
                },
                color: '#7a7268',
                opacity: 0.08,
                ringletContrast: 0.6,
            },
            {
                radiusKm: {
                    min: 119_967,
                    max: 120_500,
                },
                color: '#7a7268',
                opacity: 0.1,
                ringletContrast: 0.4,
            },
            /** The Cassini Division's outer edge thickens into the A ring. */
            {
                radiusKm: {
                    min: 120_500,
                    max: 122_170,
                },
                color: '#a89c88',
                opacity: 0.1,
                outerOpacity: 0.35,
                ringletContrast: 0.3,
            },
            /**
             * The A ring, with the Encke Gap cleared by the moon Pan, and the Keeler Gap by
             * Daphnis.
             */
            {
                radiusKm: {
                    min: 122_170,
                    max: 133_423,
                },
                color: '#d4c8ac',
                opacity: 0.65,
                outerOpacity: 0.6,
                ringletContrast: 0.2,
            },
            {
                radiusKm: {
                    min: 133_745,
                    max: 136_485,
                },
                color: '#d0c4a8',
                opacity: 0.5,
                outerOpacity: 0.4,
                ringletContrast: 0.2,
            },
            {
                radiusKm: {
                    min: 136_530,
                    max: 136_775,
                },
                color: '#ccc0a4',
                opacity: 0.45,
            },
            /** The F ring, a narrow strand herded by the moons Prometheus and Pandora. */
            {
                radiusKm: {
                    min: 140_130,
                    max: 140_270,
                },
                color: '#c8c0b0',
                opacity: 0.35,
            },
        ],
    },
    [BodyId.Mimas]: {
        id: BodyId.Mimas,
        name: 'Mimas',
        // cspell:disable-next-line
        pronunciation: 'mˈIməs',
        kind: BodyKind.Moon,
        radiusKm: 198.2,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 186_031,
            eccentricity: 0.02153,
            inclinationDegrees: 28.1306,
            meanLongitudeAtJ2000Degrees: 244.0594,
            longitudeOfPerihelionDegrees: 339.0709,
            longitudeOfAscendingNodeDegrees: 172.8668,
            periodDays: 0.9424209831,
        },
        rotation: {
            poleRightAscensionDegrees: 53.262,
            poleDeclinationDegrees: 84.383,
            primeMeridianAtJ2000Degrees: 279.05,
            primeMeridianDegreesPerDay: 381.9948902,
        },
    },
    [BodyId.Enceladus]: {
        id: BodyId.Enceladus,
        name: 'Enceladus',
        // cspell:disable-next-line
        pronunciation: 'ɛnsˈɛlədəs',
        kind: BodyKind.Moon,
        radiusKm: 252.1,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 238_410,
            eccentricity: 0.00485,
            inclinationDegrees: 28.0436,
            meanLongitudeAtJ2000Degrees: 306.6994,
            longitudeOfPerihelionDegrees: 342.9911,
            longitudeOfAscendingNodeDegrees: 169.5293,
            periodDays: 1.370215555,
        },
        rotation: {
            poleRightAscensionDegrees: 40.546,
            poleDeclinationDegrees: 83.544,
            primeMeridianAtJ2000Degrees: 356.85,
            primeMeridianDegreesPerDay: 262.7323844,
        },
    },
    [BodyId.Tethys]: {
        id: BodyId.Tethys,
        name: 'Tethys',
        // cspell:disable-next-line
        pronunciation: 'tˈiθɪs',
        kind: BodyKind.Moon,
        radiusKm: 531.1,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 294_975,
            eccentricity: 0.00094,
            inclinationDegrees: 28.1274,
            meanLongitudeAtJ2000Degrees: 327.5634,
            longitudeOfPerihelionDegrees: 336.7211,
            longitudeOfAscendingNodeDegrees: 171.836,
            periodDays: 1.887809921,
        },
        rotation: {
            poleRightAscensionDegrees: 49.123,
            poleDeclinationDegrees: 84.129,
            primeMeridianAtJ2000Degrees: 9.23,
            primeMeridianDegreesPerDay: 190.697165,
        },
    },
    [BodyId.Dione]: {
        id: BodyId.Dione,
        name: 'Dione',
        // cspell:disable-next-line
        pronunciation: 'dIˈOni',
        kind: BodyKind.Moon,
        radiusKm: 561.4,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 377_645,
            eccentricity: 0.00263,
            inclinationDegrees: 28.0255,
            meanLongitudeAtJ2000Degrees: 306.8624,
            longitudeOfPerihelionDegrees: 95.1481,
            longitudeOfAscendingNodeDegrees: 169.549,
            periodDays: 2.736916327,
        },
        rotation: {
            poleRightAscensionDegrees: 40.505,
            poleDeclinationDegrees: 83.564,
            primeMeridianAtJ2000Degrees: 357.22,
            primeMeridianDegreesPerDay: 131.5348944,
        },
    },
    [BodyId.Rhea]: {
        id: BodyId.Rhea,
        name: 'Rhea',
        // cspell:disable-next-line
        pronunciation: 'ɹˈiə',
        kind: BodyKind.Moon,
        radiusKm: 763.8,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 527_278,
            eccentricity: 0.00138,
            inclinationDegrees: 28.2731,
            meanLongitudeAtJ2000Degrees: 182.0245,
            longitudeOfPerihelionDegrees: 353.836,
            longitudeOfAscendingNodeDegrees: 169.9706,
            periodDays: 4.517504106,
        },
        rotation: {
            poleRightAscensionDegrees: 43.259,
            poleDeclinationDegrees: 83.496,
            primeMeridianAtJ2000Degrees: 229.73,
            primeMeridianDegreesPerDay: 79.69002165,
        },
    },
    [BodyId.Titan]: {
        id: BodyId.Titan,
        name: 'Titan',
        // cspell:disable-next-line
        pronunciation: 'tˈItᵊn',
        kind: BodyKind.Moon,
        radiusKm: 2574.7,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 1_221_973,
            eccentricity: 0.0288,
            inclinationDegrees: 27.7057,
            meanLongitudeAtJ2000Degrees: 137.1833,
            longitudeOfPerihelionDegrees: 347.5765,
            longitudeOfAscendingNodeDegrees: 169.0806,
            periodDays: 15.94545586,
        },
        rotation: {
            poleRightAscensionDegrees: 37.126,
            poleDeclinationDegrees: 83.658,
            primeMeridianAtJ2000Degrees: 192.73,
            primeMeridianDegreesPerDay: 22.57696507,
        },
    },
    /** Its orbit is tilted from Saturn's equator, partway toward the Sun's plane. */
    [BodyId.Iapetus]: {
        id: BodyId.Iapetus,
        name: 'Iapetus',
        // cspell:disable-next-line
        pronunciation: 'Iˈæpɪɾəs',
        kind: BodyKind.Moon,
        radiusKm: 734.5,
        parentId: BodyId.Saturn,
        orbit: {
            semiMajorAxisKm: 3_560_057,
            eccentricity: 0.02914,
            inclinationDegrees: 16.9821,
            meanLongitudeAtJ2000Degrees: 217.489,
            longitudeOfPerihelionDegrees: 11.5617,
            longitudeOfAscendingNodeDegrees: 138.8454,
            periodDays: 79.33110529,
        },
        rotation: {
            poleRightAscensionDegrees: 317.092,
            poleDeclinationDegrees: 74.786,
            primeMeridianAtJ2000Degrees: 351.27,
            primeMeridianDegreesPerDay: 4.537942572,
        },
    },
    /** Tipped over on its side, and spins backward. */
    [BodyId.Uranus]: {
        id: BodyId.Uranus,
        name: 'Uranus',
        // cspell:disable-next-line
        pronunciation: 'jˈʊɹənəs',
        kind: BodyKind.Planet,
        radiusKm: 25_362,
        parentId: BodyId.Sun,
        knownMoonCount: 29,
        orbit: {
            semiMajorAxisKm: 19.18916464 * kilometersPerAstronomicalUnit,
            eccentricity: 0.04725744,
            inclinationDegrees: 0.77263783,
            meanLongitudeAtJ2000Degrees: 313.23810451,
            longitudeOfPerihelionDegrees: 170.9542763,
            longitudeOfAscendingNodeDegrees: 74.01692503,
            periodDays: 30_687.4,
        },
        rotation: {
            poleRightAscensionDegrees: 257.311,
            poleDeclinationDegrees: -15.175,
            primeMeridianAtJ2000Degrees: 203.81,
            primeMeridianDegreesPerDay: -501.1600928,
        },
    },
    [BodyId.Miranda]: {
        id: BodyId.Miranda,
        name: 'Miranda',
        // cspell:disable-next-line
        pronunciation: 'məɹˈændə',
        kind: BodyKind.Moon,
        radiusKm: 235.8,
        parentId: BodyId.Uranus,
        orbit: {
            semiMajorAxisKm: 129_871,
            eccentricity: 0.00126,
            inclinationDegrees: 98.0443,
            meanLongitudeAtJ2000Degrees: 97.2193,
            longitudeOfPerihelionDegrees: 240.8882,
            longitudeOfAscendingNodeDegrees: 163.1903,
            periodDays: 1.413462824,
        },
        rotation: {
            poleRightAscensionDegrees: 252.805,
            poleDeclinationDegrees: -14.397,
            primeMeridianAtJ2000Degrees: 59.24,
            primeMeridianDegreesPerDay: -254.6936459,
        },
    },
    [BodyId.Ariel]: {
        id: BodyId.Ariel,
        name: 'Ariel',
        // cspell:disable-next-line
        pronunciation: 'ˈɛɹiəl',
        kind: BodyKind.Moon,
        radiusKm: 578.9,
        parentId: BodyId.Uranus,
        orbit: {
            semiMajorAxisKm: 190_943,
            eccentricity: 0.00062,
            inclinationDegrees: 97.7179,
            meanLongitudeAtJ2000Degrees: 7.0543,
            longitudeOfPerihelionDegrees: 68.2309,
            longitudeOfAscendingNodeDegrees: 167.6658,
            periodDays: 2.52038161,
        },
        rotation: {
            poleRightAscensionDegrees: 257.33,
            poleDeclinationDegrees: -15.181,
            primeMeridianAtJ2000Degrees: 155.62,
            primeMeridianDegreesPerDay: -142.8355129,
        },
    },
    [BodyId.Umbriel]: {
        id: BodyId.Umbriel,
        name: 'Umbriel',
        // cspell:disable-next-line
        pronunciation: 'ˈʌmbɹiəl',
        kind: BodyKind.Moon,
        radiusKm: 584.7,
        parentId: BodyId.Uranus,
        orbit: {
            semiMajorAxisKm: 265_990,
            eccentricity: 0.00354,
            inclinationDegrees: 97.7143,
            meanLongitudeAtJ2000Degrees: 53.1387,
            longitudeOfPerihelionDegrees: 226.748,
            longitudeOfAscendingNodeDegrees: 167.7253,
            periodDays: 4.144173294,
        },
        rotation: {
            poleRightAscensionDegrees: 257.391,
            poleDeclinationDegrees: -15.189,
            primeMeridianAtJ2000Degrees: 109.6,
            primeMeridianDegreesPerDay: -86.86895418,
        },
    },
    [BodyId.Titania]: {
        id: BodyId.Titania,
        name: 'Titania',
        // cspell:disable-next-line
        pronunciation: 'tɪtˈɑniə',
        kind: BodyKind.Moon,
        radiusKm: 788.9,
        parentId: BodyId.Uranus,
        orbit: {
            semiMajorAxisKm: 436_308,
            eccentricity: 0.00211,
            inclinationDegrees: 97.7622,
            meanLongitudeAtJ2000Degrees: 83.8815,
            longitudeOfPerihelionDegrees: 90.6993,
            longitudeOfAscendingNodeDegrees: 167.6437,
            periodDays: 8.705863444,
        },
        rotation: {
            poleRightAscensionDegrees: 257.312,
            poleDeclinationDegrees: -15.134,
            primeMeridianAtJ2000Degrees: 78.73,
            primeMeridianDegreesPerDay: -41.35144117,
        },
    },
    [BodyId.Oberon]: {
        id: BodyId.Oberon,
        name: 'Oberon',
        // cspell:disable-next-line
        pronunciation: 'ˈObəɹɑn',
        kind: BodyKind.Moon,
        radiusKm: 761.4,
        parentId: BodyId.Uranus,
        orbit: {
            semiMajorAxisKm: 583_484,
            eccentricity: 0.00238,
            inclinationDegrees: 97.9057,
            meanLongitudeAtJ2000Degrees: 155.5422,
            longitudeOfPerihelionDegrees: 343.498,
            longitudeOfAscendingNodeDegrees: 167.7083,
            periodDays: 13.46325418,
        },
        rotation: {
            poleRightAscensionDegrees: 257.391,
            poleDeclinationDegrees: -14.997,
            primeMeridianAtJ2000Degrees: 7.1,
            primeMeridianDegreesPerDay: -26.73944911,
        },
    },
    [BodyId.Neptune]: {
        id: BodyId.Neptune,
        name: 'Neptune',
        // cspell:disable-next-line
        pronunciation: 'nˈɛptun',
        kind: BodyKind.Planet,
        radiusKm: 24_622,
        parentId: BodyId.Sun,
        knownMoonCount: 16,
        orbit: {
            semiMajorAxisKm: 30.06992276 * kilometersPerAstronomicalUnit,
            eccentricity: 0.00859048,
            inclinationDegrees: 1.77004347,
            meanLongitudeAtJ2000Degrees: -55.12002969,
            longitudeOfPerihelionDegrees: 44.96476227,
            longitudeOfAscendingNodeDegrees: 131.78422574,
            periodDays: 60_189.7,
        },
        rotation: {
            poleRightAscensionDegrees: 299.36,
            poleDeclinationDegrees: 43.46,
            primeMeridianAtJ2000Degrees: 253.18,
            primeMeridianDegreesPerDay: 536.3128492,
        },
    },
    /** Orbits backward, so it was probably captured rather than formed around Neptune. */
    [BodyId.Triton]: {
        id: BodyId.Triton,
        name: 'Triton',
        // cspell:disable-next-line
        pronunciation: 'tɹˈItᵊn',
        kind: BodyKind.Moon,
        radiusKm: 1353.4,
        parentId: BodyId.Neptune,
        orbit: {
            semiMajorAxisKm: 354_768,
            eccentricity: 0.00012,
            inclinationDegrees: 129.1272,
            meanLongitudeAtJ2000Degrees: 290.4678,
            longitudeOfPerihelionDegrees: 343.2576,
            longitudeOfAscendingNodeDegrees: 222.8589,
            periodDays: 5.876730469,
        },
        rotation: {
            poleRightAscensionDegrees: 304.327,
            poleDeclinationDegrees: 20.657,
            primeMeridianAtJ2000Degrees: 309.21,
            primeMeridianDegreesPerDay: -61.25855217,
        },
    },
    /** Spins backward, tipped further over than Uranus. */
    [BodyId.Pluto]: {
        id: BodyId.Pluto,
        name: 'Pluto',
        // cspell:disable-next-line
        pronunciation: 'plˈuɾO',
        kind: BodyKind.DwarfPlanet,
        radiusKm: 1188.3,
        parentId: BodyId.Sun,
        knownMoonCount: 5,
        orbit: {
            semiMajorAxisKm: 39.48211675 * kilometersPerAstronomicalUnit,
            eccentricity: 0.2488273,
            inclinationDegrees: 17.14001206,
            meanLongitudeAtJ2000Degrees: 238.92903833,
            longitudeOfPerihelionDegrees: 224.06891629,
            longitudeOfAscendingNodeDegrees: 110.30393684,
            periodDays: 90_553,
        },
        /**
         * WGCCRE gives dwarf planets their right-hand-rule pole, the one New Horizons' maps call
         * north. Pluto spins backward, so it is the pole south of its orbit.
         */
        rotation: {
            poleRightAscensionDegrees: 132.993,
            poleDeclinationDegrees: -6.163,
            primeMeridianAtJ2000Degrees: 302.695,
            primeMeridianDegreesPerDay: 56.3625225,
        },
    },
    /** Like Pluto, its pole follows the right-hand rule. */
    [BodyId.Charon]: {
        id: BodyId.Charon,
        name: 'Charon',
        // cspell:disable-next-line
        pronunciation: 'kˈɛɹən',
        kind: BodyKind.Moon,
        radiusKm: 606,
        parentId: BodyId.Pluto,
        orbit: {
            semiMajorAxisKm: 19_596,
            eccentricity: 0.00016,
            inclinationDegrees: 112.8878,
            meanLongitudeAtJ2000Degrees: 188.6389,
            longitudeOfPerihelionDegrees: 39.7159,
            longitudeOfAscendingNodeDegrees: 227.3931,
            periodDays: 6.387222024,
        },
        rotation: {
            poleRightAscensionDegrees: 133.009,
            poleDeclinationDegrees: -6.244,
            primeMeridianAtJ2000Degrees: 124.13,
            primeMeridianDegreesPerDay: 56.36253111,
        },
    },
};

/** Each body's details file, loaded only when the body is shown up close. */
export async function loadBodyDetails(bodyId: BodyId): Promise<Readonly<BodyDetails>> {
    return (await import(`./bodies/${bodyId}.body.ts`)).default;
}
