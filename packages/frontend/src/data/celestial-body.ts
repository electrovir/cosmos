import {type PartialWithUndefined} from '@augment-vir/common';
import {type RadialScale} from '../physics/radial-scale.js';
import {type CrustBoundary} from './earth/earth-data-files.js';

export enum BodyKind {
    Star = 'star',
    Planet = 'planet',
    DwarfPlanet = 'dwarf-planet',
    Moon = 'moon',
    PlanetarySystem = 'planetary-system',
    Galaxy = 'galaxy',
    Nebula = 'nebula',
    GalaxyGroup = 'galaxy-group',
}

export enum BodyId {
    Sun = 'sun',
    Mercury = 'mercury',
    Venus = 'venus',
    Earth = 'earth',
    Moon = 'moon',
    Mars = 'mars',
    Phobos = 'phobos',
    Deimos = 'deimos',
    Jupiter = 'jupiter',
    Io = 'io',
    Europa = 'europa',
    Ganymede = 'ganymede',
    Callisto = 'callisto',
    Saturn = 'saturn',
    Mimas = 'mimas',
    Enceladus = 'enceladus',
    Tethys = 'tethys',
    Dione = 'dione',
    Rhea = 'rhea',
    Titan = 'titan',
    Iapetus = 'iapetus',
    Uranus = 'uranus',
    Miranda = 'miranda',
    Ariel = 'ariel',
    Umbriel = 'umbriel',
    Titania = 'titania',
    Oberon = 'oberon',
    Neptune = 'neptune',
    Triton = 'triton',
    Pluto = 'pluto',
    Charon = 'charon',
}

/** Whether a close-up of each body is cut open to show its layers. */
export const isCutOpenByBodyId: Readonly<Record<BodyId, boolean>> = {
    [BodyId.Sun]: true,
    [BodyId.Mercury]: false,
    [BodyId.Venus]: false,
    [BodyId.Earth]: true,
    [BodyId.Moon]: false,
    [BodyId.Mars]: false,
    [BodyId.Phobos]: false,
    [BodyId.Deimos]: false,
    [BodyId.Jupiter]: false,
    [BodyId.Io]: false,
    [BodyId.Europa]: false,
    [BodyId.Ganymede]: false,
    [BodyId.Callisto]: false,
    [BodyId.Saturn]: false,
    [BodyId.Mimas]: false,
    [BodyId.Enceladus]: false,
    [BodyId.Tethys]: false,
    [BodyId.Dione]: false,
    [BodyId.Rhea]: false,
    [BodyId.Titan]: false,
    [BodyId.Iapetus]: false,
    [BodyId.Uranus]: false,
    [BodyId.Miranda]: false,
    [BodyId.Ariel]: false,
    [BodyId.Umbriel]: false,
    [BodyId.Titania]: false,
    [BodyId.Oberon]: false,
    [BodyId.Neptune]: false,
    [BodyId.Triton]: false,
    [BodyId.Pluto]: false,
    [BodyId.Charon]: false,
};

export enum MatterState {
    Solid = 'solid',
    Liquid = 'liquid',
    Gas = 'gas',
    Plasma = 'plasma',
}

export enum LayerRegion {
    Interior = 'interior',
    Crust = 'crust',
    Atmosphere = 'atmosphere',
}

export type ValueRange = {
    min: number;
    max: number;
};

export type BodyLayer = {
    /** Used as the layer's URL path segment. */
    id: string;
    name: string;
    region: LayerRegion;
    state: MatterState;
    /** CSS color. */
    color: string;
    /**
     * Distance from the body's center to the bottom and top of the layer, in kilometers. For a
     * layer whose bottom is listed in the body's `crust.layerIdsByBoundary`, these are only typical
     * values and the crust grid gives the real ones at each point.
     */
    radiusKm: ValueRange;
    composition: string;
    description: string;
} & PartialWithUndefined<{
    /**
     * Left out of the cut face, though still drawn on the surface. In the cut, a solid layer's
     * space goes to the layer below it and anything else leaves a gap.
     */
    isHiddenInCut: boolean;
    temperatureKelvin: ValueRange;
    densityGramsPerCubicCentimeter: ValueRange;
    pressureGigapascals: ValueRange;
}>;

/**
 * Orientation by the IAU WGCCRE convention: where the north pole points on the sky, and how far the
 * prime meridian has turned.
 */
export type BodyRotation = {
    /** The north pole's direction in the equatorial (ICRF) frame. */
    poleRightAscensionDegrees: number;
    poleDeclinationDegrees: number;
    /** The prime meridian's angle `W` at the J2000 epoch. */
    primeMeridianAtJ2000Degrees: number;
    primeMeridianDegreesPerDay: number;
};

/** Keplerian orbit elements at the J2000 epoch, in the J2000 ecliptic frame, around the parent. */
export type OrbitElements = {
    semiMajorAxisKm: number;
    eccentricity: number;
    inclinationDegrees: number;
    meanLongitudeAtJ2000Degrees: number;
    longitudeOfPerihelionDegrees: number;
    longitudeOfAscendingNodeDegrees: number;
    periodDays: number;
};

/** A magnetic dipole fixed to the body, as it turns with the body. */
export type MagneticDipole = {
    /** Where the dipole's axis comes out in the northern hemisphere. */
    northPole: {
        latitudeDegrees: number;
        longitudeDegrees: number;
    };
    /** Field strength at the surface on the magnetic equator, in nanoteslas. */
    equatorialSurfaceFieldNanotesla: number;
};

/** One ring around a body, in its equatorial plane. */
export type RingBand = {
    /** Distance from the body's center to the ring's inner and outer edges, in kilometers. */
    radiusKm: ValueRange;
    /** CSS color. */
    color: string;
    /** From 0 (see-through) to 1, at the inner edge. */
    opacity: number;
} & PartialWithUndefined<{
    /** Fades linearly from `opacity` at the inner edge to this at the outer edge. */
    outerOpacity: number;
    /**
     * How much fine ringlets within the band vary its opacity and brightness, from 0 (smooth) to 1
     * (from clear to twice as dense).
     */
    ringletContrast: number;
}>;

/** The small, always-loaded facts about a body that place it in the body tree and in space. */
export type BodySummary = {
    id: BodyId;
    name: string;
    /**
     * Kokoro phonemes (misaki US notation) that `npm run build:pronunciations` in `@cosmos/scripts`
     * speaks to make this body's name clip.
     */
    pronunciation: string;
    kind: BodyKind;
    radiusKm: number;
} & PartialWithUndefined<{
    /** The body this one orbits. Omitted for the root of the tree. */
    parentId: BodyId;
    orbit: OrbitElements;
    rotation: BodyRotation;
    /** From the inside out, without overlaps. Gaps between bands are empty. */
    rings: ReadonlyArray<Readonly<RingBand>>;
    /** Every moon known to orbit it, including the many too small to be in this catalog. */
    knownMoonCount: number;
}>;

/** Everything else about a body, loaded only when it's shown up close. */
export type BodyDetails = {
    id: BodyId;
    /** Paragraphs are separated by a blank line. */
    description: string;
    /**
     * Every layer from the center outward. Interior and atmosphere layers each stack without gaps.
     * Crust layers fill the space between them, with thicknesses that vary from place to place.
     */
    layers: ReadonlyArray<Readonly<BodyLayer>>;
    massKg: number;
    /**
     * Averaged over the surface and over day and night. For a body without a surface, it's where
     * the pressure is 1 bar, or the photosphere for the Sun.
     */
    meanTemperatureKelvin: number;
} & PartialWithUndefined<{
    /** Omitted for a body known since prehistoric times. */
    discovery: {
        year: number;
        discoverer: string;
    };
    /**
     * The most common gases by volume, most common first. Omitted for a body with no atmosphere or
     * only a thin exosphere.
     */
    atmosphereGases: ReadonlyArray<
        Readonly<{
            /** A chemical formula, such as `CO₂`. */
            gas: string;
            percent: number;
        }>
    >;
    /** Omitted for a body without a solid or liquid surface under its atmosphere. */
    surfacePressureBar: number;
    magneticDipole: MagneticDipole;
    /** How to stretch thin outer layers so they can be seen. Omitted for a body drawn to scale. */
    exaggeratedRadialScale: RadialScale;
    /** A body with a crust grid (only Earth so far) maps each grid boundary to the layer above it. */
    crust: {
        layerIdsByBoundary: Readonly<Record<CrustBoundary, string>>;
    };
}>;
