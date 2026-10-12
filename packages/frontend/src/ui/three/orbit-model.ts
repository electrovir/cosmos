// cspell:words metalness
import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Group,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Quaternion,
    type Ray,
    ShaderMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import {bodyCatalog} from '../../data/body-catalog.js';
import {BodyId, BodyKind} from '../../data/celestial-body.js';
import {getBodyPosition} from '../../physics/body-position.js';
import {astronomyToScene, getBodyOrientation} from '../../physics/frames.js';
import {getMoonPosition, moonSiderealPeriodDays} from '../../physics/moon-position.js';
import {loadSmallSurfaceColor} from './body-assets.js';
import {atmosphereGlowFragmentShader, atmosphereGlowVertexShader} from './layered-body-model.js';

const orbitLinePointCount = 512;

/**
 * A body beside the focused one hides once the camera is this many times farther from the focused
 * body than the body is from its nearest bigger neighbor (or from the focused body), since by then
 * it'd be enlarged on top of that neighbor. The Moon's orbit hides the same way.
 */
const companionHideDistanceRatio = 30;

const minPickHeightShare = 0.06;

/**
 * How many times to enlarge a body so it never looks smaller than `minHeightShare` of the view's
 * height across, or 1 when it already looks that big. Zoomed out to see orbits, true-size bodies
 * shrink to nothing.
 */
export function getMinSizeScale({
    radiusKm,
    distanceKm,
    viewHeightPerDistance,
    minHeightShare,
}: Readonly<{
    radiusKm: number;
    distanceKm: number;
    /** The view's height at some distance, divided by that distance. */
    viewHeightPerDistance: number;
    minHeightShare: number;
}>) {
    return Math.max(1, (minHeightShare * viewHeightPerDistance * distanceKm) / (2 * radiusKm));
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
        /** Smaller than the Sun looks from Earth, so it's only enlarged once zoomed far out. */
        minHeightShare: 0.01,
        isSelfLit: true,
        atmosphereGlowHeightKm: undefined,
    },
    [BodyId.Earth]: {
        color: 0x3a_6f_c4,
        minHeightShare: 0.03,
        isSelfLit: false,
        atmosphereGlowHeightKm: 1000,
    },
    [BodyId.Moon]: {
        color: 0x9a_98_94,
        minHeightShare: 0.02,
        isSelfLit: false,
        atmosphereGlowHeightKm: undefined,
    },
};

/**
 * The Sun and the other bodies around the focused one's planet, plus faint lines for the planet's
 * orbit around the Sun and the Moon's orbit around Earth, all drawn around the focused body at the
 * origin. Around the Sun, the planet is Earth.
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
    const hasMoon = planetId === BodyId.Earth;
    const group = new Group();
    /** Textures that finish loading after this are dropped. */
    const lifecycle = {
        isDisposed: false,
    };

    const planetOrbitLine = createOrbitLine(0x9f_c4_ff);
    if (planetOrbit) {
        group.add(planetOrbitLine);
    }
    const moonOrbitLine = createOrbitLine(0xc8_c8_d0);
    if (hasMoon) {
        group.add(moonOrbitLine);
    }

    const companions = [
        BodyId.Sun,
        planetId,
        ...(hasMoon
            ? [
                  BodyId.Moon,
              ]
            : []),
    ]
        .filter((bodyId) => bodyId !== focusedBodyId)
        .map((bodyId) => {
            const look = assertWrap.isDefined(companionLooks[bodyId]);
            const material = look.isSelfLit
                ? new MeshBasicMaterial({
                      color: look.color,
                  })
                : new MeshStandardMaterial({
                      color: look.color,
                      roughness: 1,
                      metalness: 0,
                  });
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
            void loadSmallSurfaceColor(bodyId).then((texture) => {
                if (!texture || lifecycle.isDisposed) {
                    texture?.dispose();
                    return;
                }
                material.map = texture;
                material.color.set(0xff_ff_ff);
                material.needsUpdate = true;
            });
            return {
                bodyId,
                mesh,
                material,
                atmosphereGlow,
                minHeightShare: look.minHeightShare,
            };
        });

    return {
        group,
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
            toBodyFrame,
            cameraPosition,
            viewHeightPerDistance,
        }: Readonly<{
            daysSinceJ2000: number;
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
                            daysSinceJ2000,
                        }),
                    );
                }
                companion.mesh.scale.setScalar(
                    getMinSizeScale({
                        radiusKm: bodyCatalog[companion.bodyId].radiusKm,
                        distanceKm: cameraPosition.distanceTo(
                            companion.mesh.position.clone().applyQuaternion(toBodyFrame),
                        ),
                        viewHeightPerDistance,
                        minHeightShare: companion.minHeightShare,
                    }),
                );
            });
            const sunPosition = astronomyToScene(
                getBodyPosition({
                    bodyId: BodyId.Sun,
                    daysSinceJ2000,
                }).sub(focusedPosition),
            );
            const groupWorldQuaternion = group.getWorldQuaternion(new Quaternion());
            companions.forEach((companion) => {
                companion.atmosphereGlow?.material.uniforms.towardSun?.value
                    .copy(sunPosition)
                    .sub(companion.mesh.position)
                    .normalize()
                    .applyQuaternion(groupWorldQuaternion);
            });
            const cameraDistanceKm = cameraPosition.length();
            companions.forEach((companion) => {
                const radiusKm = bodyCatalog[companion.bodyId].radiusKm;
                const neighborGapKm = Math.min(
                    companion.mesh.position.length(),
                    ...companions
                        .filter((other) => bodyCatalog[other.bodyId].radiusKm > radiusKm)
                        .map((other) => other.mesh.position.distanceTo(companion.mesh.position)),
                );
                companion.mesh.visible =
                    cameraDistanceKm <= neighborGapKm * companionHideDistanceRatio;
            });
            const planetOffset = getBodyPosition({
                bodyId: planetId,
                daysSinceJ2000,
            }).sub(focusedPosition);
            moonOrbitLine.visible =
                cameraDistanceKm <=
                getMoonPosition(daysSinceJ2000).length() * companionHideDistanceRatio;
            if (hasMoon && moonOrbitLine.visible) {
                /**
                 * The Sun's pull shifts the Moon's orbit, so one period later it isn't back where
                 * it started. Spreading that gap along the path closes the loop.
                 */
                const closingGap = getMoonPosition(daysSinceJ2000 + moonSiderealPeriodDays).sub(
                    getMoonPosition(daysSinceJ2000),
                );
                setOrbitLinePoints({
                    line: moonOrbitLine,
                    getPosition(progress) {
                        return astronomyToScene(
                            getMoonPosition(daysSinceJ2000 + progress * moonSiderealPeriodDays)
                                .sub(closingGap.clone().multiplyScalar(progress))
                                .add(planetOffset),
                        );
                    },
                });
            }
        },
        dispose() {
            lifecycle.isDisposed = true;
            [
                planetOrbitLine,
                moonOrbitLine,
            ].forEach((line) => {
                line.geometry.dispose();
                line.material.dispose();
            });
            companions.forEach((companion) => {
                companion.mesh.geometry.dispose();
                companion.material.map?.dispose();
                companion.material.dispose();
                companion.atmosphereGlow?.geometry.dispose();
                companion.atmosphereGlow?.material.dispose();
            });
        },
    };
}

export type OrbitModel = ReturnType<typeof createOrbitModel>;
