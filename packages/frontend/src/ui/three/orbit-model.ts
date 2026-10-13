// cspell:words metalness
import {assertWrap} from '@augment-vir/assert';
import {createArray, getObjectTypedValues, type PartialWithUndefined} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Euler,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    Line,
    LineBasicMaterial,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Quaternion,
    type Ray,
    ShaderMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {bodyCatalog, kilometersPerAstronomicalUnit} from '../../data/body-catalog.js';
import {BodyId, BodyKind, type OrbitElements} from '../../data/celestial-body.js';
import {getBodyPosition} from '../../physics/body-position.js';
import {astronomyToScene, getBodyOrientation} from '../../physics/frames.js';
import {
    getMoonPosition,
    moonSemiMajorAxisKm,
    moonSiderealPeriodDays,
} from '../../physics/moon-position.js';
import {getOrbitPosition} from '../../physics/orbit.js';
import {createRandom} from '../../physics/solar-wind-weather.js';
import {loadSmallSurfaceColor} from './body-assets.js';
import {sampleMapPerPixel} from './equirectangular-map-shader.js';
import {atmosphereGlowFragmentShader, atmosphereGlowVertexShader} from './layered-body-model.js';
import {createRingMesh} from './ring-model.js';
import {createDistantSunMaterial} from './sun-model.js';

const orbitLinePointCount = 512;

/**
 * A moon beside the focused body hides once the camera is this many times farther from the focused
 * body than the moon is from its nearest bigger neighbor (or from the focused body), since by then
 * its planet is enlarged over its orbit. Moons' orbits hide the same way. Planets shrink to fit
 * their orbits instead.
 */
const companionHideDistanceRatio = 30;

const minPickHeightShare = 0.06;

/**
 * An enlarged body's radius never passes this share of how close its orbit comes to its nearest
 * bigger neighbor's (or the focused body's), so zoomed far enough out that its orbit is tight on
 * screen, it shrinks instead of swallowing its neighbor.
 */
const maxRadiusNeighborGapShare = 0.25;

/**
 * The Sun's radius never passes this share of Mercury's distance from it, so zoomed out it stays
 * inside every planet's orbit. Nothing is bigger than the Sun, so the neighbor rule above would
 * only keep it off the focused body.
 */
const sunMaxRadiusMercuryGapShare = 0.6;

/**
 * The other planets' orbits and the asteroid belt only show once the camera is this far from the
 * focused body, so they don't streak across a close-up's sky.
 */
const systemOverviewMinCameraDistanceKm = 10_000_000;
const maxAsteroidCount = 1000;
/** An average asteroid's smallest size across, as a share of the view's height. */
const asteroidMinHeightShare = 0.012;
/**
 * How many asteroids show with the camera at {@link asteroidReferenceDistanceKm}. The count scales
 * inversely with camera distance: the belt shrinks on screen as the camera pulls back while each
 * asteroid keeps its size on screen, so fewer show to keep them from piling up, and more fill in as
 * the camera comes closer.
 */
const referenceAsteroidCount = 120;
const asteroidReferenceDistanceKm = 3_000_000_000;

/** The smallest share of the view's height a body shrinks to when it's kept within `maxRadiusKm`. */
const shrunkMinHeightShare = 0.004;

/**
 * How many times to enlarge a body so it never looks smaller than `minHeightShare` of the view's
 * height across, or 1 when it already looks that big. Zoomed out to see orbits, true-size bodies
 * shrink to nothing. The enlarged radius stops at `maxRadiusKm`, though it never shrinks below
 * {@link shrunkMinHeightShare} of the view or below true size, so a body stays a visible dot.
 */
export function getMinSizeScale({
    radiusKm,
    distanceKm,
    viewHeightPerDistance,
    minHeightShare,
    maxRadiusKm,
}: Readonly<
    {
        radiusKm: number;
        /**
         * The camera's distance from the focused body, not from this body, so a body's size only
         * changes with the zoom and not as it moves nearer or farther.
         */
        distanceKm: number;
        /** The view's height at some distance, divided by that distance. */
        viewHeightPerDistance: number;
        minHeightShare: number;
    } & PartialWithUndefined<{
        maxRadiusKm: number;
    }>
>) {
    const scalePerHeightShare = (viewHeightPerDistance * distanceKm) / (2 * radiusKm);
    return Math.max(
        1,
        shrunkMinHeightShare * scalePerHeightShare,
        Math.min(minHeightShare * scalePerHeightShare, (maxRadiusKm ?? Infinity) / radiusKm),
    );
}

/**
 * How far outside a body's tap area a ray from the camera passes, as an angle, so negative means
 * it's a hit and the most negative is the best one. The area reaches a little past the body's drawn
 * edge, and is at least `minPickHeightShare` of the view's height across, since a small body is
 * hard to hit exactly.
 */
export function getPickMissRadians({
    ray,
    center,
    radiusKm,
    viewHeightPerDistance,
}: Readonly<{
    ray: Readonly<Ray>;
    center: Readonly<Vector3>;
    /** As drawn, including any enlargement. */
    radiusKm: number;
    /** The view's height at some distance, divided by that distance. */
    viewHeightPerDistance: number;
}>) {
    const offset = center.clone().sub(ray.origin);
    return (
        offset.angleTo(ray.direction) -
        Math.max(
            (minPickHeightShare * viewHeightPerDistance) / 2,
            1.3 * Math.asin(Math.min(1, radiusKm / offset.length())),
        )
    );
}

/**
 * Made-up asteroids spread like the main belt's: between the 4:1 and 2:1 resonances with Jupiter,
 * on mildly tilted and stretched orbits, each with its own lopsided shape and turn. Seeded so the
 * belt looks the same every time.
 */
function createAsteroids() {
    const random = createRandom(1);
    return createArray(maxAsteroidCount, () => {
        const semiMajorAxisAu = 2.1 + random() * 1.2;
        const size = 0.5 + random();
        return {
            orbit: {
                semiMajorAxisKm: semiMajorAxisAu * kilometersPerAstronomicalUnit,
                eccentricity: random() * 0.2,
                inclinationDegrees: random() * random() * 20,
                meanLongitudeAtJ2000Degrees: random() * 360,
                longitudeOfPerihelionDegrees: random() * 360,
                longitudeOfAscendingNodeDegrees: random() * 360,
                /** Kepler's third law, scaled from Earth's year. */
                periodDays: 365.256363 * semiMajorAxisAu ** 1.5,
            } satisfies OrbitElements,
            stretch: new Vector3(
                0.6 + random() * 0.6,
                0.6 + random() * 0.6,
                0.6 + random() * 0.6,
            ).multiplyScalar(size),
            rotation: new Quaternion().setFromEuler(
                new Euler(random() * 2 * Math.PI, random() * 2 * Math.PI, random() * 2 * Math.PI),
            ),
        };
    });
}

/** A unit-sized lumpy rock, which each asteroid stretches and turns differently. */
function createRockGeometry() {
    const random = createRandom(2);
    const sphere = new IcosahedronGeometry(1, 1);
    /** Without normals and UVs, which split at seams, shared corners merge and move together. */
    sphere.deleteAttribute('normal');
    sphere.deleteAttribute('uv');
    const geometry = mergeVertices(sphere);
    sphere.dispose();
    const positions = geometry.getAttribute('position');
    createArray(positions.count, (index) => index).forEach((index) => {
        const corner = new Vector3()
            .fromBufferAttribute(positions, index)
            .setLength(0.7 + random() * 0.4);
        positions.setXYZ(index, corner.x, corner.y, corner.z);
    });
    geometry.computeVertexNormals();
    return geometry;
}

function createOrbitLine(color: number) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array((orbitLinePointCount + 1) * 3), 3),
    );
    const line = new Line(
        geometry,
        new LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
        }),
    );
    /** The line's points move every frame, so a bounding sphere computed once would go stale. */
    line.frustumCulled = false;
    return line;
}

/**
 * Fills a line with one full trip, starting at the current position. The path is rebuilt from the
 * focused body each frame, rather than drawn once around the parent and moved, so that its first
 * point sits exactly on the body: with 32-bit vertex positions a path millions of kilometers across
 * drifts visibly off a body seen up close.
 */
function setOrbitLinePoints({
    line,
    getPosition,
}: Readonly<{
    line: Line;
    /** Takes 0 to 1 through one trip. */
    getPosition: (progress: number) => {
        x: number;
        y: number;
        z: number;
    };
}>) {
    const attribute = line.geometry.getAttribute('position');
    createArray(orbitLinePointCount + 1, (index) => index).forEach((index) => {
        const position = getPosition(index / orbitLinePointCount);
        attribute.setXYZ(index, position.x, position.y, position.z);
    });
    attribute.needsUpdate = true;
}

/** Earth's smallest size across, as a share of the view's height. */
const earthMinHeightShare = 0.05;

/**
 * The inner planets keep their true sizes relative to Earth when enlarged. The giants are too big
 * for that, since sized against Earth they would fill the view.
 */
function getInnerPlanetMinHeightShare(bodyId: BodyId) {
    return (
        (earthMinHeightShare * bodyCatalog[bodyId].radiusKm) / bodyCatalog[BodyId.Earth].radiusKm
    );
}

/** How each body looks when drawn beside the focused body. */
const companionLooks: Readonly<
    Record<
        BodyId,
        | {
              color: number;
              /** Its smallest size across, as a share of the view's height. */
              minHeightShare: number;
              /** Glows with its own light instead of being lit by the Sun. */
              isSelfLit: boolean;
              /**
               * How high above the surface the glow of daylight scattered by its air reaches, as
               * drawn when it's the focused body. Undefined for a body without that glow.
               */
              atmosphereGlowHeightKm: number | undefined;
          }
        | undefined
    >
> = {
    [BodyId.Sun]: {
        color: 0xff_f2_d0,
        minHeightShare: 0.04,
        isSelfLit: true,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Earth]: {
        color: 0x3a_6f_c4,
        minHeightShare: earthMinHeightShare,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Moon]: {
        color: 0x9a_98_94,
        minHeightShare: 0.03,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Mercury]: {
        color: 0x9b_92_8a,
        minHeightShare: getInnerPlanetMinHeightShare(BodyId.Mercury),
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Venus]: {
        color: 0xe8_d8_b0,
        minHeightShare: getInnerPlanetMinHeightShare(BodyId.Venus),
        isSelfLit: false,
        atmosphereGlowHeightKm: 250,
    },
    [BodyId.Mars]: {
        color: 0xc0_60_38,
        minHeightShare: getInnerPlanetMinHeightShare(BodyId.Mars),
        isSelfLit: false,
        atmosphereGlowHeightKm: 200,
    },
    [BodyId.Phobos]: {
        color: 0x6e_64_5a,
        minHeightShare: 0.012,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Deimos]: {
        color: 0x8a_7c_6c,
        minHeightShare: 0.012,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Jupiter]: {
        color: 0xd8_b9_8c,
        minHeightShare: 0.028,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Io]: {
        color: 0xe0_c8_60,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Europa]: {
        color: 0xd8_c8_b0,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Ganymede]: {
        color: 0x9a_8c_7c,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Callisto]: {
        color: 0x6a_5e_52,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Saturn]: {
        color: 0xe3_cf_9a,
        minHeightShare: 0.028,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Mimas]: {
        color: 0xb8_b4_ac,
        minHeightShare: 0.012,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Enceladus]: {
        color: 0xf4_f6_f8,
        minHeightShare: 0.012,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Tethys]: {
        color: 0xdc_dc_d8,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Dione]: {
        color: 0xc8_c6_c0,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Rhea]: {
        color: 0xc4_c0_b8,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Titan]: {
        color: 0xd8_a0_50,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: 600,
    },
    [BodyId.Iapetus]: {
        color: 0x9a_90_80,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Uranus]: {
        color: 0x9f_d8_e0,
        minHeightShare: 0.024,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Miranda]: {
        color: 0xa8_a8_a8,
        minHeightShare: 0.012,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Ariel]: {
        color: 0xb4_b0_ac,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Umbriel]: {
        color: 0x6c_6a_68,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Titania]: {
        color: 0xa4_9c_94,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Oberon]: {
        color: 0x98_8c_84,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Neptune]: {
        color: 0x4a_6f_d8,
        minHeightShare: 0.024,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Triton]: {
        color: 0xd8_cc_c4,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Pluto]: {
        color: 0xd8_c0_a8,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Charon]: {
        color: 0x9a_94_8c,
        minHeightShare: 0.016,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
};

const innerPlanetIds: ReadonlyArray<BodyId> = [
    BodyId.Mercury,
    BodyId.Venus,
    BodyId.Earth,
    BodyId.Mars,
];

/**
 * How much to shrink every inner planet's `minHeightShare` together, so none passes its
 * `maxRadiusKm` while their sizes on screen keep the ratio of their true sizes. The smallest still
 * stays at least {@link shrunkMinHeightShare} of the view.
 */
function getInnerPlanetShrink({
    planets,
    cameraDistanceKm,
    viewHeightPerDistance,
}: Readonly<{
    planets: ReadonlyArray<
        Readonly<{
            minHeightShare: number;
            maxRadiusKm: number;
        }>
    >;
    /** From the focused body. */
    cameraDistanceKm: number;
    /** The view's height at some distance, divided by that distance. */
    viewHeightPerDistance: number;
}>) {
    return Math.max(
        Math.min(
            1,
            ...planets.map((planet) => {
                return (
                    (2 * planet.maxRadiusKm) /
                    (viewHeightPerDistance * cameraDistanceKm * planet.minHeightShare)
                );
            }),
        ),
        shrunkMinHeightShare / Math.min(...planets.map((planet) => planet.minHeightShare)),
    );
}

/**
 * The body, then its parent, and so on up to the Sun. Its return type is annotated since it
 * recurses.
 */
function getLineageIds(bodyId: BodyId): BodyId[] {
    const parentId = bodyCatalog[bodyId].parentId;
    return [
        bodyId,
        ...(parentId ? getLineageIds(parentId) : []),
    ];
}

/**
 * How close two bodies' orbits come, treating each orbit as a circle at its average distance, so it
 * stays the same as the bodies move. For a body and its parent, it's the body's average distance.
 */
function getOrbitGapKm({firstId, secondId}: Readonly<{firstId: BodyId; secondId: BodyId}>) {
    const firstLineage = getLineageIds(firstId);
    const secondLineage = getLineageIds(secondId);
    const commonId = assertWrap.isDefined(firstLineage.find((id) => secondLineage.includes(id)));
    const [
        firstOrbitKm,
        secondOrbitKm,
    ] = [
        firstLineage,
        secondLineage,
    ].map((lineage) => {
        const branchId = lineage[lineage.indexOf(commonId) - 1];
        return branchId ? (bodyCatalog[branchId].orbit?.semiMajorAxisKm ?? moonSemiMajorAxisKm) : 0;
    });
    return Math.abs((firstOrbitKm ?? 0) - (secondOrbitKm ?? 0));
}

/**
 * A body's smallest size across, as a share of the view's height. The same whether it's focused or
 * beside the focused body, so focusing a body doesn't resize it.
 */
export function getBodyMinHeightShare(bodyId: BodyId | undefined) {
    return (bodyId && companionLooks[bodyId]?.minHeightShare) ?? earthMinHeightShare;
}

/**
 * The Sun, every body that orbits it, and the moons of the focused one's planet, plus faint lines
 * for their orbits and the asteroid belt, all drawn around the focused body at the origin. Around
 * the Sun, the planet is Earth.
 */
export function createOrbitModel({focusedBodyId}: Readonly<{focusedBodyId: BodyId}>) {
    const focused = bodyCatalog[focusedBodyId];
    const planetId =
        focused.kind === BodyKind.Moon
            ? assertWrap.isDefined(focused.parentId)
            : focused.parentId
              ? focusedBodyId
              : BodyId.Earth;
    const planetOrbit = bodyCatalog[planetId].orbit;
    const group = new Group();
    /** Textures that finish loading after this are dropped. */
    const lifecycle = {
        isDisposed: false,
    };

    const planetOrbitLine = createOrbitLine(0x9f_c4_ff);
    if (planetOrbit) {
        group.add(planetOrbitLine);
    }
    const moonOrbitLines = getObjectTypedValues(bodyCatalog)
        .filter((summary) => summary.parentId === planetId)
        .map((summary) => {
            const line = createOrbitLine(0xc8_c8_d0);
            group.add(line);
            return {
                line,
                /** Undefined for the Moon, which follows `getMoonPosition`. */
                orbit: summary.orbit,
            };
        });
    /**
     * Unlike the planet's own path, these are drawn once around the Sun and moved, since they're
     * only shown zoomed far out, where 32-bit drift can't be seen.
     */
    const otherOrbitLines = getObjectTypedValues(bodyCatalog)
        .filter((summary) => summary.parentId === BodyId.Sun && summary.id !== planetId)
        .map((summary) => {
            const orbit = assertWrap.isDefined(summary.orbit);
            const line = createOrbitLine(0x6f_8c_b8);
            setOrbitLinePoints({
                line,
                getPosition(progress) {
                    return astronomyToScene(
                        getOrbitPosition({
                            orbit,
                            daysSinceJ2000: progress * orbit.periodDays,
                        }),
                    );
                },
            });
            group.add(line);
            return line;
        });

    const asteroids = createAsteroids();
    const asteroidBelt = new InstancedMesh(
        createRockGeometry(),
        new MeshStandardMaterial({
            color: 0x8a_7e_70,
            roughness: 1,
            metalness: 0,
            flatShading: true,
        }),
        maxAsteroidCount,
    );
    /** Its asteroids move every frame, like the orbit lines. */
    asteroidBelt.frustumCulled = false;
    group.add(asteroidBelt);

    const companions = getObjectTypedValues(bodyCatalog)
        .filter((summary) => {
            return (
                summary.id !== focusedBodyId &&
                (!summary.parentId ||
                    summary.parentId === BodyId.Sun ||
                    summary.parentId === planetId)
            );
        })
        .map(({id: bodyId}) => {
            const look = assertWrap.isDefined(companionLooks[bodyId]);
            const surfaceMaterial = look.isSelfLit
                ? undefined
                : sampleMapPerPixel(
                      new MeshStandardMaterial({
                          color: look.color,
                          roughness: 1,
                          metalness: 0,
                      }),
                  );
            const material = surfaceMaterial ?? createDistantSunMaterial();
            const mesh = new Mesh(
                new SphereGeometry(bodyCatalog[bodyId].radiusKm, 64, 32),
                material,
            );
            group.add(mesh);
            const atmosphereGlow =
                look.atmosphereGlowHeightKm == undefined
                    ? undefined
                    : new Mesh(
                          new SphereGeometry(
                              bodyCatalog[bodyId].radiusKm + look.atmosphereGlowHeightKm,
                              64,
                              32,
                          ),
                          new ShaderMaterial({
                              vertexShader: atmosphereGlowVertexShader,
                              fragmentShader: atmosphereGlowFragmentShader,
                              uniforms: {
                                  towardSun: {
                                      value: new Vector3(1, 0, 0),
                                  },
                              },
                              transparent: true,
                              blending: AdditiveBlending,
                              depthWrite: false,
                              side: DoubleSide,
                          }),
                      );
            if (atmosphereGlow) {
                mesh.add(atmosphereGlow);
            }
            const ringBands = bodyCatalog[bodyId].rings;
            const rings = ringBands
                ? createRingMesh({
                      rings: ringBands,
                      bodyRadiusKm: bodyCatalog[bodyId].radiusKm,
                  })
                : undefined;
            if (rings) {
                mesh.add(rings.mesh);
            }
            if (surfaceMaterial) {
                void loadSmallSurfaceColor(bodyId).then((texture) => {
                    if (!texture || lifecycle.isDisposed) {
                        texture?.dispose();
                        return;
                    }
                    surfaceMaterial.map = texture;
                    surfaceMaterial.color.set(0xff_ff_ff);
                    surfaceMaterial.needsUpdate = true;
                });
            }
            return {
                bodyId,
                mesh,
                material,
                surfaceMaterial,
                atmosphereGlow,
                rings,
                minHeightShare: look.minHeightShare,
            };
        });

    const state = {
        /** Infinite when no neighbor is bigger than the focused body. */
        focusedMaxRadiusKm: Infinity,
        focusedMinHeightShare: getBodyMinHeightShare(focusedBodyId),
    };

    return {
        group,
        /** The largest radius to enlarge the focused body to, as of the last update. */
        getFocusedMaxRadiusKm() {
            return state.focusedMaxRadiusKm;
        },
        /**
         * The focused body's smallest size across, as a share of the view's height, as of the last
         * update.
         */
        getFocusedMinHeightShare() {
            return state.focusedMinHeightShare;
        },
        /** The body beside the focused one that a ray from the camera points at, if any. */
        pickCompanion({
            ray,
            viewHeightPerDistance,
        }: Readonly<{
            ray: Readonly<Ray>;
            /** The view's height at some distance, divided by that distance. */
            viewHeightPerDistance: number;
        }>) {
            return companions
                .filter((companion) => companion.mesh.visible)
                .map((companion) => {
                    return {
                        bodyId: companion.bodyId,
                        missRadians: getPickMissRadians({
                            ray,
                            center: companion.mesh.getWorldPosition(new Vector3()),
                            radiusKm:
                                bodyCatalog[companion.bodyId].radiusKm *
                                companion.mesh.getWorldScale(new Vector3()).x,
                            viewHeightPerDistance,
                        }),
                    };
                })
                .filter((candidate) => candidate.missRadians < 0)
                .toSorted((first, second) => first.missRadians - second.missRadians)
                .at(0);
        },
        update({
            daysSinceJ2000,
            getSpinDaysSinceJ2000,
            toBodyFrame,
            cameraPosition,
            viewHeightPerDistance,
        }: Readonly<{
            daysSinceJ2000: number;
            /**
             * The time a body's spin is drawn at, which runs behind `daysSinceJ2000` when time is
             * fast.
             */
            getSpinDaysSinceJ2000: (bodyId: BodyId) => number;
            /** Turns the J2000 ecliptic scene frame into the body's frame, which the scene draws in. */
            toBodyFrame: Readonly<Quaternion>;
            cameraPosition: Readonly<Vector3>;
            /** The view's height at some distance, divided by that distance. */
            viewHeightPerDistance: number;
        }>) {
            group.quaternion.copy(toBodyFrame);
            const focusedPosition = getBodyPosition({
                bodyId: focusedBodyId,
                daysSinceJ2000,
            });
            if (planetOrbit) {
                setOrbitLinePoints({
                    line: planetOrbitLine,
                    getPosition(progress) {
                        return astronomyToScene(
                            getBodyPosition({
                                bodyId: planetId,
                                daysSinceJ2000: daysSinceJ2000 + progress * planetOrbit.periodDays,
                            }).sub(focusedPosition),
                        );
                    },
                });
            }
            companions.forEach((companion) => {
                companion.mesh.position.copy(
                    astronomyToScene(
                        getBodyPosition({
                            bodyId: companion.bodyId,
                            daysSinceJ2000,
                        }).sub(focusedPosition),
                    ),
                );
                const rotation = bodyCatalog[companion.bodyId].rotation;
                if (rotation) {
                    companion.mesh.quaternion.copy(
                        getBodyOrientation({
                            rotation,
                            daysSinceJ2000: getSpinDaysSinceJ2000(companion.bodyId),
                        }),
                    );
                }
            });
            const sunPosition = astronomyToScene(
                getBodyPosition({
                    bodyId: BodyId.Sun,
                    daysSinceJ2000,
                }).sub(focusedPosition),
            );
            const groupWorldQuaternion = group.getWorldQuaternion(new Quaternion());
            companions.forEach((companion) => {
                const towardSun = sunPosition.clone().sub(companion.mesh.position).normalize();
                companion.atmosphereGlow?.material.uniforms.towardSun?.value
                    .copy(towardSun)
                    .applyQuaternion(groupWorldQuaternion);
                companion.rings?.update({
                    towardSun: towardSun.applyQuaternion(
                        companion.mesh.quaternion.clone().invert(),
                    ),
                });
            });
            const cameraDistanceKm = cameraPosition.length();
            const focusedRadiusKm = bodyCatalog[focusedBodyId].radiusKm;
            const sunMaxRadiusKm =
                getOrbitGapKm({
                    firstId: BodyId.Sun,
                    secondId: BodyId.Mercury,
                }) * sunMaxRadiusMercuryGapShare;
            const focusedMaxRadiusKm =
                focusedBodyId === BodyId.Sun
                    ? sunMaxRadiusKm
                    : Math.min(
                          ...companions
                              .filter((companion) => {
                                  return bodyCatalog[companion.bodyId].radiusKm > focusedRadiusKm;
                              })
                              .map((companion) => {
                                  return getOrbitGapKm({
                                      firstId: focusedBodyId,
                                      secondId: companion.bodyId,
                                  });
                              }),
                      ) * maxRadiusNeighborGapShare;
            const companionSizes = companions.map((companion) => {
                const radiusKm = bodyCatalog[companion.bodyId].radiusKm;
                const neighborGapKm = Math.min(
                    ...[
                        focusedBodyId,
                        ...companions
                            .filter((other) => bodyCatalog[other.bodyId].radiusKm > radiusKm)
                            .map((other) => other.bodyId),
                    ].map((otherId) => {
                        return getOrbitGapKm({
                            firstId: companion.bodyId,
                            secondId: otherId,
                        });
                    }),
                );
                return {
                    ...companion,
                    radiusKm,
                    neighborGapKm,
                    maxRadiusKm:
                        companion.bodyId === BodyId.Sun
                            ? sunMaxRadiusKm
                            : neighborGapKm * maxRadiusNeighborGapShare,
                };
            });
            const innerPlanetShrink = getInnerPlanetShrink({
                planets: [
                    ...companionSizes,
                    {
                        bodyId: focusedBodyId,
                        minHeightShare: getBodyMinHeightShare(focusedBodyId),
                        maxRadiusKm: focusedMaxRadiusKm,
                    },
                ].filter((planet) => innerPlanetIds.includes(planet.bodyId)),
                cameraDistanceKm,
                viewHeightPerDistance,
            });
            companionSizes.forEach((companion) => {
                const parentId = bodyCatalog[companion.bodyId].parentId;
                companion.mesh.visible =
                    !parentId ||
                    parentId === BodyId.Sun ||
                    cameraDistanceKm <= companion.neighborGapKm * companionHideDistanceRatio;
                const isInnerPlanet = innerPlanetIds.includes(companion.bodyId);
                companion.mesh.scale.setScalar(
                    getMinSizeScale({
                        radiusKm: companion.radiusKm,
                        distanceKm: cameraDistanceKm,
                        viewHeightPerDistance,
                        minHeightShare: isInnerPlanet
                            ? companion.minHeightShare * innerPlanetShrink
                            : companion.minHeightShare,
                        maxRadiusKm: isInnerPlanet ? undefined : companion.maxRadiusKm,
                    }),
                );
            });
            const isFocusedInnerPlanet = innerPlanetIds.includes(focusedBodyId);
            state.focusedMaxRadiusKm = isFocusedInnerPlanet ? Infinity : focusedMaxRadiusKm;
            state.focusedMinHeightShare =
                getBodyMinHeightShare(focusedBodyId) *
                (isFocusedInnerPlanet ? innerPlanetShrink : 1);
            const isSystemOverview = cameraDistanceKm >= systemOverviewMinCameraDistanceKm;
            const sunOffset = astronomyToScene(focusedPosition.clone().negate());
            otherOrbitLines.forEach((line) => {
                line.visible = isSystemOverview;
                line.position.copy(sunOffset);
            });
            asteroidBelt.visible = isSystemOverview;
            if (isSystemOverview) {
                asteroidBelt.position.copy(sunOffset);
                /** The asteroids are in random order, so any leading slice spreads evenly. */
                asteroidBelt.count = Math.max(
                    1,
                    Math.round(
                        Math.min(
                            maxAsteroidCount,
                            (referenceAsteroidCount * asteroidReferenceDistanceKm) /
                                cameraDistanceKm,
                        ),
                    ),
                );
                const asteroidScale = getMinSizeScale({
                    radiusKm: 1,
                    distanceKm: cameraDistanceKm,
                    viewHeightPerDistance,
                    minHeightShare: asteroidMinHeightShare,
                });
                asteroids.slice(0, asteroidBelt.count).forEach((asteroid, index) => {
                    const position = astronomyToScene(
                        getOrbitPosition({
                            orbit: asteroid.orbit,
                            daysSinceJ2000,
                        }),
                    );
                    asteroidBelt.setMatrixAt(
                        index,
                        new Matrix4().compose(
                            position,
                            asteroid.rotation,
                            asteroid.stretch.clone().multiplyScalar(asteroidScale),
                        ),
                    );
                });
                asteroidBelt.instanceMatrix.needsUpdate = true;
            }
            const planetOffset = getBodyPosition({
                bodyId: planetId,
                daysSinceJ2000,
            }).sub(focusedPosition);
            moonOrbitLines.forEach(({line, orbit}) => {
                line.visible =
                    cameraDistanceKm <=
                    (orbit?.semiMajorAxisKm ?? getMoonPosition(daysSinceJ2000).length()) *
                        companionHideDistanceRatio;
                if (!line.visible) {
                    return;
                } else if (orbit) {
                    setOrbitLinePoints({
                        line,
                        getPosition(progress) {
                            return astronomyToScene(
                                getOrbitPosition({
                                    orbit,
                                    daysSinceJ2000: daysSinceJ2000 + progress * orbit.periodDays,
                                }).add(planetOffset),
                            );
                        },
                    });
                    return;
                }
                /**
                 * The Sun's pull shifts the Moon's orbit, so one period later it isn't back where
                 * it started. Spreading that gap along the path closes the loop.
                 */
                const closingGap = getMoonPosition(daysSinceJ2000 + moonSiderealPeriodDays).sub(
                    getMoonPosition(daysSinceJ2000),
                );
                setOrbitLinePoints({
                    line,
                    getPosition(progress) {
                        return astronomyToScene(
                            getMoonPosition(daysSinceJ2000 + progress * moonSiderealPeriodDays)
                                .sub(closingGap.clone().multiplyScalar(progress))
                                .add(planetOffset),
                        );
                    },
                });
            });
        },
        dispose() {
            lifecycle.isDisposed = true;
            [
                planetOrbitLine,
                ...moonOrbitLines.map((moonOrbit) => moonOrbit.line),
                ...otherOrbitLines,
            ].forEach((line) => {
                line.geometry.dispose();
                line.material.dispose();
            });
            asteroidBelt.geometry.dispose();
            asteroidBelt.material.dispose();
            asteroidBelt.dispose();
            companions.forEach((companion) => {
                companion.mesh.geometry.dispose();
                companion.surfaceMaterial?.map?.dispose();
                companion.material.dispose();
                companion.atmosphereGlow?.geometry.dispose();
                companion.atmosphereGlow?.material.dispose();
                companion.rings?.dispose();
            });
        },
    };
}

export type OrbitModel = ReturnType<typeof createOrbitModel>;
