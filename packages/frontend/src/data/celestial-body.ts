import {type PartialWithUndefined} from '@augment-vir/common';
import {type RadialScale} from '../physics/radial-scale.js';
import {type CrustBoundary} from './earth/earth-data-files.js';

export enum BodyKind {
    Star = 'star',
    Planet = 'planet',
    Moon = 'moon',
    PlanetarySystem = 'planetary-system',
    Galaxy = 'galaxy',
    Nebula = 'nebula',
    GalaxyGroup = 'galaxy-group',
}

/** Whether a close-up of each kind of body is cut open to show its layers. */
export const isCutOpenByBodyKind: Readonly<Record<BodyKind, boolean>> = {
    [BodyKind.Star]: true,
    [BodyKind.Planet]: true,
    [BodyKind.Moon]: false,
    [BodyKind.PlanetarySystem]: false,
    [BodyKind.Galaxy]: false,
    [BodyKind.Nebula]: false,
    [BodyKind.GalaxyGroup]: false,
};

export enum BodyId {
    Sun = 'sun',
    Earth = 'earth',
    Moon = 'moon',
}

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

/** The small, always-loaded facts about a body that place it in the body tree and in space. */
export type BodySummary = {
    id: BodyId;
    name: string;
    kind: BodyKind;
    radiusKm: number;
} & PartialWithUndefined<{
    /** The body this one orbits. Omitted for the root of the tree. */
    parentId: BodyId;
    orbit: OrbitElements;
    rotation: BodyRotation;
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
} & PartialWithUndefined<{
    magneticDipole: MagneticDipole;
    /** How to stretch thin outer layers so they can be seen. Omitted for a body drawn to scale. */
    exaggeratedRadialScale: RadialScale;
    /** A body with a crust grid (only Earth so far) maps each grid boundary to the layer above it. */
    crust: {
        layerIdsByBoundary: Readonly<Record<CrustBoundary, string>>;
    };
}>;
