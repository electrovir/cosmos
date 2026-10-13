// cspell:words slerp
import {assertWrap} from '@augment-vir/assert';
import {getObjectTypedValues, mapObjectValues, randomInteger} from '@augment-vir/common';
import {
    AmbientLight,
    MOUSE,
    MathUtils,
    PerspectiveCamera,
    PointLight,
    Quaternion,
    Raycaster,
    Scene,
    Vector2,
    Vector3,
    WebGLRenderer,
} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {bodyCatalog} from '../../data/body-catalog.js';
import {
    BodyId,
    BodyKind,
    isCutOpenByBodyId,
    type BodyDetails,
    type BodySummary,
} from '../../data/celestial-body.js';
import {degreesToRadians} from '../../physics/angles.js';
import {getBodyPosition} from '../../physics/body-position.js';
import {
    astronomyToScene,
    getBodyOrientation,
    latitudeLongitudeToDirection,
} from '../../physics/frames.js';
import {getDaysSinceJ2000} from '../../physics/orbit.js';
import {toDisplayRadius, trueRadialScale, type RadialScale} from '../../physics/radial-scale.js';
import {
    advanceSolarWind,
    createRandom,
    getSolarWindConditions,
    quietSolarWind,
    smoothSolarWindConditions,
    type SolarWindConditions,
    type SolarWindState,
} from '../../physics/solar-wind-weather.js';
import {type Star} from '../../physics/star-catalog.js';
import {defaultFieldOpacity} from '../field-opacity.js';
import {FocusScale} from '../focus-scale.js';
import {advanceSpinLag} from '../time-speed.js';
import {type BodyAssets} from './body-assets.js';
import {createLayeredBodyModel, type LayeredBodyModel} from './layered-body-model.js';
import {createMagnetosphereModel, type MagnetosphereModel} from './magnetosphere-model.js';
import {
    createOrbitModel,
    getBodyMinHeightShare,
    getMinSizeScale,
    getPickMissRadians,
    type OrbitModel,
} from './orbit-model.js';
import {
    createRenderQualityScaler,
    type RenderEffect,
    type RenderQuality,
} from './render-quality.js';
import {createSkyModel} from './sky-model.js';
import {createSunModel, type SunModel} from './sun-model.js';

export type BodyPick = NonNullable<ReturnType<LayeredBodyModel['pick']>>;

/** What the page shows about the moment being drawn. */
export type SceneReadout = {
    /** The moment being drawn, which runs ahead of the real time when time is sped up. */
    unixMilliseconds: number;
    conditions: SolarWindConditions;
};

/** The selected layer's cut face glows, pulsing between these intensities. */
const highlightGlow = {
    min: 0.04,
    max: 0.14,
    pulsesPerSecond: 0.8,
};
/** Pointer travel, in pixels, beyond which a press counts as an orbit drag instead of a click. */
const clickMoveTolerance = 12;
/** Readouts change too fast to read if sent every frame. */
const readoutIntervalSeconds = 0.25;
/** Far enough to take in Pluto's whole orbit around the Sun, in kilometers. */
const maxCameraDistanceKm = 20_000_000_000;
/** Just past the Moon's farthest point from Earth. */
const moonOrbitMaxRadiusKm = 410_000;
/**
 * Earth's Hill sphere: how far out its gravity can hold onto moons. Other planets' scale with how
 * far out their moons reach.
 */
const neighborhoodRadiusKm = 1_500_000;

/**
 * How far out the moons of the body's planet reach (for a moon, its own planet's). Bodies without
 * moons get the Moon's reach, which the scale distances were first set for.
 */
function getMoonSystemRadiusKm(summary: Readonly<BodySummary>) {
    const planetId =
        summary.kind === BodyKind.Moon ? assertWrap.isDefined(summary.parentId) : summary.id;
    const moonReachesKm = getObjectTypedValues(bodyCatalog)
        .filter((moon) => moon.kind === BodyKind.Moon && moon.parentId === planetId)
        .map((moon) => {
            return moon.orbit
                ? moon.orbit.semiMajorAxisKm * (1 + moon.orbit.eccentricity)
                : moonOrbitMaxRadiusKm;
        });
    return moonReachesKm.length ? Math.max(...moonReachesKm) : moonOrbitMaxRadiusKm;
}

/** Where the camera goes when the URL asks for a scale, given the focused body. */
const focusScaleDistancesKm: Readonly<
    Record<FocusScale, (summary: Readonly<BodySummary>) => number>
> = {
    [FocusScale.Body](summary) {
        return summary.radiusKm * 5.5;
    },
    [FocusScale.Moons](summary) {
        return (getMoonSystemRadiusKm(summary) * 2_000_000) / moonOrbitMaxRadiusKm;
    },
    /** Out past Jupiter, where the inner planets still show apart from the Sun. */
    [FocusScale.System]() {
        return 3_000_000_000;
    },
    /** Nothing past the solar system is drawn yet. */
    [FocusScale.Galaxy]() {
        return maxCameraDistanceKm;
    },
    [FocusScale.Group]() {
        return maxCameraDistanceKm;
    },
    [FocusScale.Universe]() {
        return maxCameraDistanceKm;
    },
};
/** How high above the equator a close-up camera sits. */
const closeUpLatitudeDegrees = 30;
const cameraFlightSeconds = 1.4;

function easeInOut(progress: number) {
    return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

type BodyViewParams = {
    summary: Readonly<BodySummary>;
    details: Readonly<BodyDetails>;
    assets: Readonly<BodyAssets>;
    radialScale: RadialScale;
};

/** A body as drawn up close, which the scene swaps whole when the body or its scale changes. */
type BodyView = {
    layeredModel: LayeredBodyModel;
    magnetosphereModel: MagnetosphereModel | undefined;
    orbitModel: OrbitModel | undefined;
    sunModel: SunModel | undefined;
    /**
     * How far around from the cut a close-up camera arrives, so a body whose surface is the main
     * thing to see isn't mostly hidden behind its cut.
     */
    closeUpTurnFromCutRadians: number;
    /** Where the drawn atmosphere ends, in kilometers from the center. */
    outerDisplayRadiusKm: number;
    /**
     * Where the drawn surface is, in kilometers from the center. Zoomed out, bodies are sized by
     * this, so a tall drawn atmosphere doesn't make the planet itself look smaller than its
     * neighbors.
     */
    surfaceDisplayRadiusKm: number;
    dispose: () => void;
};

/** Leaves out atmosphere layers too thin to see and too tall to fit, like Earth's exosphere. */
function getOuterDisplayRadiusKm({
    summary,
    details,
    radialScale,
}: Readonly<Pick<BodyViewParams, 'summary' | 'details' | 'radialScale'>>) {
    return toDisplayRadius({
        scale: radialScale,
        realKm: Math.max(
            summary.radiusKm,
            ...details.layers
                .map((layer) => layer.radiusKm.max)
                .filter((radiusKm) => radiusKm <= summary.radiusKm * 2),
        ),
    });
}

function createPlanetView({
    summary,
    details,
    assets,
    radialScale,
}: Readonly<BodyViewParams>): BodyView {
    const layeredModel = createLayeredBodyModel({
        summary,
        details,
        assets,
        radialScale,
    });
    const magnetosphereModel = details.magneticDipole
        ? createMagnetosphereModel({
              surfaceRadiusKm: summary.radiusKm,
              magneticDipole: details.magneticDipole,
              radialScale,
              cutPlanes: layeredModel.cutPlanes,
          })
        : undefined;
    if (magnetosphereModel) {
        layeredModel.group.add(magnetosphereModel.group);
    }
    const orbitModel = summary.parentId
        ? createOrbitModel({
              focusedBodyId: summary.id,
          })
        : undefined;
    if (orbitModel) {
        layeredModel.group.add(orbitModel.group);
    }
    return {
        layeredModel,
        magnetosphereModel,
        orbitModel,
        sunModel: undefined,
        closeUpTurnFromCutRadians: 0,
        outerDisplayRadiusKm: getOuterDisplayRadiusKm({
            summary,
            details,
            radialScale,
        }),
        surfaceDisplayRadiusKm: toDisplayRadius({
            scale: radialScale,
            realKm: summary.radiusKm,
        }),
        dispose() {
            layeredModel.dispose();
            magnetosphereModel?.dispose();
            orbitModel?.dispose();
        },
    };
}

function createStarView({
    summary,
    details,
    assets,
    radialScale,
}: Readonly<BodyViewParams>): BodyView {
    const sunModel = createSunModel({
        radiusKm: summary.radiusKm,
    });
    const layeredModel = createLayeredBodyModel({
        summary,
        details,
        assets,
        radialScale,
        customSurfaceMaterial: sunModel.surfaceMaterial,
    });
    sunModel.setCutPlanes(layeredModel.cutPlanes);
    const orbitModel = createOrbitModel({
        focusedBodyId: summary.id,
    });
    layeredModel.group.add(sunModel.group, orbitModel.group);
    return {
        layeredModel,
        magnetosphereModel: undefined,
        orbitModel,
        sunModel,
        closeUpTurnFromCutRadians: degreesToRadians(35),
        outerDisplayRadiusKm: getOuterDisplayRadiusKm({
            summary,
            details,
            radialScale,
        }),
        surfaceDisplayRadiusKm: toDisplayRadius({
            scale: radialScale,
            realKm: summary.radiusKm,
        }),
        dispose() {
            layeredModel.dispose();
            sunModel.dispose();
            orbitModel.dispose();
        },
    };
}

const bodyViewFactories: Readonly<
    Record<BodyKind, ((params: Readonly<BodyViewParams>) => BodyView) | undefined>
> = {
    [BodyKind.Planet]: createPlanetView,
    [BodyKind.DwarfPlanet]: createPlanetView,
    [BodyKind.Moon]: createPlanetView,
    [BodyKind.Star]: createStarView,
    [BodyKind.PlanetarySystem]: undefined,
    [BodyKind.Galaxy]: undefined,
    [BodyKind.Nebula]: undefined,
    [BodyKind.GalaxyGroup]: undefined,
};

/**
 * The 3D view. Draws the focused body fixed in its own frame (north up), with the Sun's light and
 * the solar wind turned to match the current time. The camera turns with the Sun, so the body spins
 * beneath it.
 */
export function createCosmosScene() {
    const renderer = new WebGLRenderer({
        antialias: true,
        /** Depths from meters to a million kilometers don't fit a normal depth buffer. */
        logarithmicDepthBuffer: true,
    });
    /** The body's cut is clipped out of its surface meshes. */
    renderer.localClippingEnabled = true;
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 1, maxCameraDistanceKm * 4);
    camera.position
        .copy(
            latitudeLongitudeToDirection({
                latitudeDegrees: closeUpLatitudeDegrees,
                longitudeDegrees: 45,
            }),
        )
        .multiplyScalar(focusScaleDistancesKm[FocusScale.Body](bodyCatalog[BodyId.Earth]));
    const sky = createSkyModel();
    scene.add(sky.group);
    /** No falloff with distance, so every planet is lit as brightly as Earth is. */
    const sunLight = new PointLight(0xff_ff_ff, 3, 0, 0);
    scene.add(sunLight, new AmbientLight(0xff_ff_ff, 0.06));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.MIDDLE = MOUSE.PAN;
    controls.enableDamping = true;
    /** Two-finger touch only zooms. A capture listener runs before the controls' own. */
    renderer.domElement.addEventListener(
        'pointerdown',
        (event) => {
            controls.enablePan = event.pointerType === 'mouse';
        },
        {
            capture: true,
        },
    );
    controls.maxDistance = maxCameraDistanceKm;

    const drawingBufferSize = new Vector2();
    const random = createRandom(
        randomInteger({
            min: 0,
            max: 2 ** 32 - 1,
        }),
    );

    const current: {
        summary: Readonly<BodySummary> | undefined;
        details: Readonly<BodyDetails> | undefined;
        assets: Readonly<BodyAssets> | undefined;
        view: BodyView | undefined;
        magneticFieldOpacity: number;
        /** From 0 to 1, fading the field and wind in up close and out when zoomed away. */
        magnetosphereFade: number;
        selectedLayerId: string | undefined;
        disabledEffects: ReadonlyArray<RenderEffect>;
        /** How many times faster than real time the shown time runs. */
        timeSpeed: number;
        simulationMilliseconds: number;
        /** How far each body's spin runs behind the shown time, which it does when time is fast. */
        spinLagMilliseconds: Record<BodyId, number>;
        animationSeconds: number;
        weather: Readonly<SolarWindState>;
        /** The wind's conditions with quick swings averaged out, so the field shape changes gently. */
        conditions: Readonly<SolarWindConditions>;
        /** The Sun's longitude in the body's frame on the last frame, which the camera follows. */
        sunLongitudeRadians: number | undefined;
        secondsSinceReadout: number;
        rightInsetPixels: number;
        /** Eases toward `rightInsetPixels` so the view doesn't jump when the panels appear. */
        shownInsetPixels: number | undefined;
        /** The scale the camera's distance falls in on the last frame. */
        focusScale: FocusScale | undefined;
        /** The last scale passed to `setFocusScale`. */
        requestedFocusScale: FocusScale | undefined;
        /** A tapped body the camera will fly to once its view is built. */
        pendingBodyId: BodyId | undefined;
        /**
         * A camera move that eases in over several frames. It flies from wherever the camera was,
         * even from beside another body, so `startTarget` is where the view centered at the start.
         */
        cameraFlight:
            | {
                  startTarget: Vector3;
                  /** Turns with the Sun along with the camera. */
                  startPosition: Vector3;
                  /**
                   * The last body's north, which rolls to this body's north on the way. Turns with
                   * the Sun along with the camera.
                   */
                  startUp: Vector3;
                  endDistanceKm: number;
                  /** Swings to the Sun's side on the way, to look into the cut. */
                  isToSunSide: boolean;
                  elapsedSeconds: number;
              }
            | undefined;
        onFocusScale: ((focusScale: FocusScale) => void) | undefined;
        onBodyTap: ((bodyId: BodyId) => void) | undefined;
        onPick: ((pick: Readonly<BodyPick> | undefined) => void) | undefined;
        onReadout: ((readout: Readonly<SceneReadout>) => void) | undefined;
        onRenderQualityChange: ((quality: Readonly<RenderQuality>) => void) | undefined;
    } = {
        summary: undefined,
        details: undefined,
        assets: undefined,
        view: undefined,
        magneticFieldOpacity: defaultFieldOpacity,
        magnetosphereFade: 0,
        selectedLayerId: undefined,
        disabledEffects: [],
        timeSpeed: 1,
        simulationMilliseconds: Date.now(),
        spinLagMilliseconds: mapObjectValues(bodyCatalog, () => {
            return 0;
        }),
        animationSeconds: 0,
        weather: quietSolarWind,
        conditions: getSolarWindConditions(quietSolarWind),
        sunLongitudeRadians: undefined,
        secondsSinceReadout: readoutIntervalSeconds,
        rightInsetPixels: 0,
        shownInsetPixels: undefined,
        focusScale: undefined,
        requestedFocusScale: undefined,
        pendingBodyId: undefined,
        cameraFlight: undefined,
        onFocusScale: undefined,
        onBodyTap: undefined,
        onPick: undefined,
        onReadout: undefined,
        onRenderQualityChange: undefined,
    };

    const qualityScaler = createRenderQualityScaler({
        applyQuality({resolutionScale, disabledEffects}) {
            /** Past 2, more pixels are hard to see but cost as much as any others. */
            renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2) * resolutionScale);
            current.disabledEffects = disabledEffects;
            current.view?.magnetosphereModel?.setDisabledEffects(disabledEffects);
        },
    });

    function startCameraFlight({
        startTarget,
        startPosition,
        startUp,
        endDistanceKm,
        isToSunSide,
    }: Readonly<{
        startTarget: Readonly<Vector3>;
        startPosition: Readonly<Vector3>;
        startUp: Readonly<Vector3>;
        endDistanceKm: number;
        isToSunSide: boolean;
    }>) {
        current.cameraFlight = {
            startTarget: startTarget.clone(),
            startPosition: startPosition.clone(),
            startUp: startUp.clone(),
            endDistanceKm,
            isToSunSide,
            elapsedSeconds: 0,
        };
        /** User drags would fight the flight, which sets the camera every frame. */
        controls.enabled = false;
    }

    function flyCamera({
        frameSeconds,
        sunLongitudeRadians,
    }: Readonly<{
        frameSeconds: number;
        sunLongitudeRadians: number | undefined;
    }>) {
        if (!current.cameraFlight) {
            return;
        }
        const flight = {
            ...current.cameraFlight,
            /**
             * A new body's first frame stalls while its textures upload and its shaders compile.
             * Capping each frame's step keeps that stall from skipping the flight.
             */
            elapsedSeconds: current.cameraFlight.elapsedSeconds + Math.min(frameSeconds, 1 / 30),
        };
        current.cameraFlight = flight;
        const progress = Math.min(flight.elapsedSeconds / cameraFlightSeconds, 1);
        const eased = easeInOut(progress);
        const startDirection = flight.startPosition.clone().normalize();
        const closeUpLatitudeRadians = degreesToRadians(closeUpLatitudeDegrees);
        const endLongitudeRadians =
            sunLongitudeRadians == undefined
                ? undefined
                : sunLongitudeRadians + (current.view?.closeUpTurnFromCutRadians ?? 0);
        const endDirection =
            flight.isToSunSide && endLongitudeRadians != undefined
                ? new Vector3(
                      Math.cos(closeUpLatitudeRadians) * Math.cos(endLongitudeRadians),
                      Math.sin(closeUpLatitudeRadians),
                      -Math.cos(closeUpLatitudeRadians) * Math.sin(endLongitudeRadians),
                  )
                : startDirection;
        const startDistanceKm = flight.startPosition.length();
        /** Distances span orders of magnitude, so they ease by ratio instead of by difference. */
        const distanceKm = startDistanceKm * (flight.endDistanceKm / startDistanceKm) ** eased;
        /**
         * The view turns onto the body in the first half, while it is still far enough away to stay
         * in view. Sliding over the whole flight would leave the body off to the side once the
         * camera is close.
         */
        controls.target
            .copy(flight.startTarget)
            .multiplyScalar(1 - easeInOut(Math.min(progress * 2, 1)));
        camera.position
            .copy(startDirection)
            .applyQuaternion(
                new Quaternion().slerp(
                    new Quaternion().setFromUnitVectors(startDirection, endDirection),
                    eased,
                ),
            )
            .multiplyScalar(distanceKm);
        /** `controls.update` aims the camera with `lookAt`, which keeps `camera.up` on top. */
        camera.up
            .copy(flight.startUp)
            .applyQuaternion(
                new Quaternion().slerp(
                    new Quaternion().setFromUnitVectors(flight.startUp, new Vector3(0, 1, 0)),
                    eased,
                ),
            );
        if (progress >= 1) {
            camera.up.set(0, 1, 0);
            current.cameraFlight = undefined;
            controls.target.set(0, 0, 0);
            controls.enabled = true;
            current.focusScale = getDistanceFocusScale();
        }
    }

    /**
     * Where the view centered and where the camera is, carried from one body's frame into
     * another's, or `undefined` when either body has no frame.
     */
    function getCameraPoseInFrame({
        from,
        to,
    }: Readonly<{
        from: Readonly<BodySummary>;
        to: Readonly<BodySummary>;
    }>) {
        const fromFrame = getBodyFrame(from);
        const toFrame = getBodyFrame(to);
        if (!fromFrame || !toFrame) {
            return undefined;
        }
        const fromFrameToWorld = fromFrame.toBodyFrame.clone().invert();
        const offsetToFrom = astronomyToScene(
            getBodyPosition({
                bodyId: from.id,
                daysSinceJ2000: toFrame.daysSinceJ2000,
            }).sub(
                getBodyPosition({
                    bodyId: to.id,
                    daysSinceJ2000: toFrame.daysSinceJ2000,
                }),
            ),
        );
        const target = controls.target
            .clone()
            .applyQuaternion(fromFrameToWorld)
            .add(offsetToFrom)
            .applyQuaternion(toFrame.toBodyFrame);
        const cameraPosition = camera.position
            .clone()
            .applyQuaternion(fromFrameToWorld)
            .add(offsetToFrom)
            .applyQuaternion(toFrame.toBodyFrame);
        return {
            target,
            cameraPosition,
            up: new Vector3(0, 1, 0)
                .applyQuaternion(fromFrameToWorld)
                .applyQuaternion(toFrame.toBodyFrame),
        };
    }

    function rebuildView(previousSummary: Readonly<BodySummary> | undefined) {
        if (current.view) {
            scene.remove(current.view.layeredModel.group);
            current.view.dispose();
            current.view = undefined;
        }
        if (!current.summary || !current.details || !current.assets) {
            return;
        }
        const createView = bodyViewFactories[current.summary.kind];
        if (!createView) {
            return;
        }
        const view = createView({
            summary: current.summary,
            details: current.details,
            assets: current.assets,
            radialScale: current.details.exaggeratedRadialScale ?? trueRadialScale,
        });
        view.layeredModel.setSelectedLayer(current.selectedLayerId);
        view.sunModel?.setSelectedLayer(current.selectedLayerId);
        view.magnetosphereModel?.setFieldOpacity(
            current.magneticFieldOpacity * current.magnetosphereFade,
        );
        view.magnetosphereModel?.setDisabledEffects(current.disabledEffects);
        scene.add(view.layeredModel.group);
        current.view = view;
        current.sunLongitudeRadians = undefined;
        controls.minDistance = current.summary.radiusKm * 1.2;
        if (
            current.requestedFocusScale == undefined ||
            current.requestedFocusScale === FocusScale.Body
        ) {
            const endDistanceKm = focusScaleDistancesKm[FocusScale.Body](current.summary);
            const startPose =
                previousSummary && previousSummary.id !== current.summary.id
                    ? getCameraPoseInFrame({
                          from: previousSummary,
                          to: current.summary,
                      })
                    : undefined;
            if (startPose) {
                startCameraFlight({
                    startTarget: startPose.target,
                    startPosition: startPose.cameraPosition,
                    startUp: startPose.up,
                    endDistanceKm,
                    isToSunSide: true,
                });
                const towardCut = getBodyFrame(current.summary)?.towardCut;
                /** The flight swings to the cut's side itself, so the first frame shouldn't. */
                current.sunLongitudeRadians = towardCut
                    ? Math.atan2(-towardCut.z, towardCut.x)
                    : undefined;
            } else {
                camera.position.setLength(endDistanceKm);
                current.focusScale = getDistanceFocusScale();
            }
        }
    }

    /** The time a body's spin is drawn at, which runs behind the shown time when time is fast. */
    function getSpinDaysSinceJ2000(bodyId: BodyId) {
        return getDaysSinceJ2000(
            current.simulationMilliseconds - current.spinLagMilliseconds[bodyId],
        );
    }

    /**
     * The turn from the J2000 ecliptic into the body's own frame and where the Sun is in that frame
     * (unless the body is the Sun), or `undefined` for a body with no known rotation.
     */
    function getBodyFrame(summary: Readonly<BodySummary>) {
        if (!summary.rotation) {
            return undefined;
        }
        const daysSinceJ2000 = getDaysSinceJ2000(current.simulationMilliseconds);
        const toBodyFrame = getBodyOrientation({
            rotation: summary.rotation,
            daysSinceJ2000: getSpinDaysSinceJ2000(summary.id),
        }).invert();
        const bodyPosition = getBodyPosition({
            bodyId: summary.id,
            daysSinceJ2000,
        });
        const sunPosition = summary.parentId
            ? astronomyToScene(bodyPosition.clone().negate()).applyQuaternion(toBodyFrame)
            : undefined;
        return {
            daysSinceJ2000,
            toBodyFrame,
            sunPosition,
            towardSun: sunPosition?.clone().normalize(),
            /** The cut faces the Sun, or Earth for the Sun itself, and the camera follows it. */
            towardCut: astronomyToScene(
                getBodyPosition({
                    bodyId: summary.parentId ? BodyId.Sun : BodyId.Earth,
                    daysSinceJ2000,
                }).sub(bodyPosition),
            )
                .applyQuaternion(toBodyFrame)
                .normalize(),
        };
    }

    /**
     * Picks the scale by how wide a circle around the body fits the view's height. A body far
     * bigger than its moons' orbits, like the Sun, stays up close until it looks small, and skips
     * the moons scale.
     */
    function getDistanceFocusScale() {
        const fitRadiusKm = camera.position.length() * Math.tan(degreesToRadians(camera.fov / 2));
        const summary = current.summary ?? bodyCatalog[BodyId.Earth];
        const moonSystemRadiusKm = getMoonSystemRadiusKm(summary);
        const closeUpMaxRadiusKm = Math.max(moonSystemRadiusKm, summary.radiusKm * 10);
        return fitRadiusKm <= closeUpMaxRadiusKm
            ? FocusScale.Body
            : fitRadiusKm <= (moonSystemRadiusKm * neighborhoodRadiusKm) / moonOrbitMaxRadiusKm
              ? FocusScale.Moons
              : FocusScale.System;
    }

    /** Renders a slice of a wider view so the body centers in the area the overlay doesn't cover. */
    function updateProjection() {
        const viewerSize = renderer.getSize(new Vector2());
        if (!viewerSize.x || !viewerSize.y) {
            return;
        }
        const insetPixels = Math.min(current.shownInsetPixels ?? 0, viewerSize.x / 2);
        camera.aspect = (viewerSize.x + insetPixels) / viewerSize.y;
        camera.setViewOffset(
            viewerSize.x + insetPixels,
            viewerSize.y,
            insetPixels,
            0,
            viewerSize.x,
            viewerSize.y,
        );
    }

    const raycaster = new Raycaster();
    const pointer: {
        downPosition: Vector2 | undefined;
        activePointerIds: number[];
    } = {
        downPosition: undefined,
        activePointerIds: [],
    };
    /**
     * If a pointer's `pointerup` or `pointercancel` never arrives, OrbitControls keeps counting it:
     * one finger then pinch-zooms, three fingers do nothing, and its document-wide move listener
     * turns drags over the HTML panels into camera moves. A primary pointerdown means the browser
     * has no other pointer of that type down, so anything still tracked is stale.
     */
    function forgetStalePointers(event: PointerEvent) {
        if (!event.isPrimary) {
            return;
        }
        pointer.activePointerIds = [];
        /** The controls keep their pointer list untyped. */
        Object.assign(controls, {
            _pointers: [],
            _pointerPositions: {},
        });
        /** Reconnecting drops the controls' gesture state and document listeners. */
        controls.connect(renderer.domElement);
    }
    window.addEventListener('pointerdown', forgetStalePointers, {
        capture: true,
    });
    renderer.domElement.addEventListener('pointerdown', (event) => {
        pointer.activePointerIds = [
            ...pointer.activePointerIds,
            event.pointerId,
        ];
        /** A second finger means a pinch zoom, which never ends in a click. */
        pointer.downPosition =
            pointer.activePointerIds.length === 1 && event.button === 0
                ? new Vector2(event.clientX, event.clientY)
                : undefined;
    });
    renderer.domElement.addEventListener('pointercancel', (event) => {
        pointer.activePointerIds = pointer.activePointerIds.filter((id) => id !== event.pointerId);
        pointer.downPosition = undefined;
    });
    renderer.domElement.addEventListener('pointerup', (event) => {
        pointer.activePointerIds = pointer.activePointerIds.filter((id) => id !== event.pointerId);
        const downPosition = pointer.downPosition;
        pointer.downPosition = undefined;
        if (
            !downPosition ||
            !current.view ||
            downPosition.distanceTo(new Vector2(event.clientX, event.clientY)) > clickMoveTolerance
        ) {
            return;
        }
        const canvasRect = renderer.domElement.getBoundingClientRect();
        raycaster.setFromCamera(
            new Vector2(
                ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
                -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1,
            ),
            camera,
        );
        const viewHeightPerDistance = 2 * Math.tan(degreesToRadians(camera.fov / 2));
        const companionPick = current.view.orbitModel?.pickCompanion({
            ray: raycaster.ray,
            viewHeightPerDistance,
        });
        const isCloseUp = current.focusScale === FocusScale.Body;
        /** Zoomed out, tapping the focused body zooms back in to it instead of picking a layer. */
        const focusedMissRadians =
            !isCloseUp && current.summary
                ? getPickMissRadians({
                      ray: raycaster.ray,
                      center: new Vector3(),
                      radiusKm:
                          current.view.outerDisplayRadiusKm *
                          getMinSizeScale({
                              radiusKm: current.view.surfaceDisplayRadiusKm,
                              distanceKm: camera.position.length(),
                              viewHeightPerDistance,
                              minHeightShare:
                                  current.view.orbitModel?.getFocusedMinHeightShare() ??
                                  getBodyMinHeightShare(current.summary.id),
                              maxRadiusKm: current.view.orbitModel?.getFocusedMaxRadiusKm(),
                          }),
                      viewHeightPerDistance,
                  })
                : undefined;
        const tappedBodyId =
            focusedMissRadians != undefined &&
            focusedMissRadians < Math.min(0, companionPick?.missRadians ?? 0)
                ? current.summary?.id
                : companionPick?.bodyId;
        if (tappedBodyId) {
            if (tappedBodyId !== current.summary?.id) {
                current.pendingBodyId = tappedBodyId;
            }
            current.onBodyTap?.(tappedBodyId);
            return;
        } else if (!isCloseUp) {
            return;
        } else if (!current.summary || !isCutOpenByBodyId[current.summary.id]) {
            return;
        }
        const pick = current.view.layeredModel.pick(raycaster.ray);
        const isSameLayer = !!pick && pick.layer.id === current.selectedLayerId;
        setSelectedLayer(isSameLayer ? undefined : pick?.layer.id);
        current.onPick?.(isSameLayer ? undefined : pick);
    });

    function setSelectedLayer(layerId: string | undefined) {
        current.selectedLayerId = layerId;
        current.view?.layeredModel.setSelectedLayer(layerId);
        current.view?.sunModel?.setSelectedLayer(layerId);
    }

    const frameClock: {
        lastMilliseconds: number | undefined;
        isPaused: boolean;
    } = {
        lastMilliseconds: undefined,
        isPaused: false,
    };

    function renderFrame(timeMilliseconds: number) {
        const frameSeconds =
            (timeMilliseconds - (frameClock.lastMilliseconds ?? timeMilliseconds)) / 1000;
        frameClock.lastMilliseconds = timeMilliseconds;
        if (qualityScaler.recordFrame(frameSeconds)) {
            current.onRenderQualityChange?.(qualityScaler.getQuality());
        }
        current.simulationMilliseconds += frameSeconds * 1000 * current.timeSpeed;
        current.spinLagMilliseconds = mapObjectValues(bodyCatalog, (bodyId, summary) => {
            return summary.rotation
                ? advanceSpinLag({
                      spinLagMilliseconds: current.spinLagMilliseconds[bodyId],
                      frameSeconds,
                      speed: current.timeSpeed,
                      spinPeriodMilliseconds:
                          (360 / summary.rotation.primeMeridianDegreesPerDay) * 86_400_000,
                  })
                : 0;
        });
        current.animationSeconds += frameSeconds;
        /** The wind's own weather runs on the wall clock, so speeding up time doesn't blur it. */
        current.weather = advanceSolarWind({
            state: current.weather,
            elapsedSeconds: frameSeconds,
            random,
        });
        current.conditions = smoothSolarWindConditions({
            previous: current.conditions,
            next: getSolarWindConditions(current.weather),
            elapsedSeconds: frameSeconds,
            timeScaleSeconds: 3,
        });
        const conditions = current.conditions;

        const bodyFrame = current.summary ? getBodyFrame(current.summary) : undefined;
        const towardSun = bodyFrame?.towardSun;
        const towardCut = bodyFrame?.towardCut;
        /**
         * The camera turns with the cut (toward the Sun, or toward Earth for the Sun) around the
         * body's axis, so the body spins beneath it while north stays up for the orbit controls.
         */
        const sunLongitudeRadians = towardCut ? Math.atan2(-towardCut.z, towardCut.x) : undefined;
        /** On a body's first frame, the camera swings to the cut's side to look into it. */
        if (sunLongitudeRadians != undefined) {
            const sunTurnRadians =
                sunLongitudeRadians -
                (current.sunLongitudeRadians ??
                    Math.atan2(-camera.position.z, camera.position.x) -
                        (current.view?.closeUpTurnFromCutRadians ?? 0));
            (current.cameraFlight?.startPosition ?? camera.position).applyAxisAngle(
                new Vector3(0, 1, 0),
                sunTurnRadians,
            );
            /** A panned view's center turns with the camera, or the view would drift. */
            if (!current.cameraFlight) {
                controls.target.applyAxisAngle(new Vector3(0, 1, 0), sunTurnRadians);
            }
            current.cameraFlight?.startUp.applyAxisAngle(new Vector3(0, 1, 0), sunTurnRadians);
        }
        if (current.shownInsetPixels !== current.rightInsetPixels) {
            const insetGap = current.rightInsetPixels - (current.shownInsetPixels ?? 0);
            current.shownInsetPixels =
                Math.abs(insetGap) < 0.5
                    ? current.rightInsetPixels
                    : current.rightInsetPixels -
                      /** Capped like the camera flight's step, so a stalled frame doesn't skip it. */
                      insetGap * Math.exp(-6 * Math.min(frameSeconds, 1 / 30));
            updateProjection();
        }
        current.sunLongitudeRadians = sunLongitudeRadians;
        flyCamera({
            frameSeconds,
            sunLongitudeRadians,
        });
        controls.update();
        const focusScale = getDistanceFocusScale();
        /** A flight passes through scales on its way, which shouldn't change the URL. */
        const isZoomedToNewScale =
            !!current.focusScale && focusScale !== current.focusScale && !current.cameraFlight;
        /**
         * Set before telling the app, which passes the scale straight back to `setFocusScale`. That
         * must see the camera is already there, or it starts a flight that swings the camera.
         */
        current.focusScale = focusScale;
        if (isZoomedToNewScale) {
            current.onFocusScale?.(focusScale);
        }
        renderer.getDrawingBufferSize(drawingBufferSize);
        sky.update({
            cameraPosition: camera.position,
            toBodyFrame: bodyFrame?.toBodyFrame,
            sunPosition: bodyFrame?.sunPosition,
            sunRadiusKm: bodyCatalog[BodyId.Sun].radiusKm,
            pixelRatio: renderer.getPixelRatio(),
        });
        /** Without a Sun position, the Sun is the focused body, at the center. */
        sunLight.position.copy(bodyFrame?.sunPosition ?? new Vector3());
        if (current.view) {
            /** The cut, field, and wind hide when zoomed out so they don't clutter the orbits. */
            const isCloseUp = focusScale === FocusScale.Body;
            const viewHeightPerDistance = 2 * Math.tan(degreesToRadians(camera.fov / 2));
            const magnetosphereFade = MathUtils.clamp(
                current.magnetosphereFade + (isCloseUp ? 2 : -2) * Math.min(frameSeconds, 1 / 30),
                0,
                1,
            );
            if (current.view.magnetosphereModel) {
                current.view.magnetosphereModel.group.visible = magnetosphereFade > 0;
                if (magnetosphereFade !== current.magnetosphereFade) {
                    current.view.magnetosphereModel.setFieldOpacity(
                        current.magneticFieldOpacity * magnetosphereFade,
                    );
                }
            }
            current.magnetosphereFade = magnetosphereFade;
            if (bodyFrame) {
                current.view.orbitModel?.update({
                    ...bodyFrame,
                    getSpinDaysSinceJ2000,
                    cameraPosition: camera.position,
                    viewHeightPerDistance,
                });
            }
            const bodyScale = getMinSizeScale({
                radiusKm: current.view.surfaceDisplayRadiusKm,
                distanceKm: camera.position.length(),
                viewHeightPerDistance,
                minHeightShare:
                    current.view.orbitModel?.getFocusedMinHeightShare() ??
                    getBodyMinHeightShare(current.summary?.id),
                maxRadiusKm: current.view.orbitModel?.getFocusedMaxRadiusKm(),
            });
            const glow =
                highlightGlow.min +
                ((highlightGlow.max - highlightGlow.min) *
                    (1 -
                        Math.cos(
                            2 * Math.PI * highlightGlow.pulsesPerSecond * current.animationSeconds,
                        ))) /
                    2;
            current.view.layeredModel.update({
                towardSun: towardCut ?? new Vector3(1, 0, 0),
                glow,
                animationSeconds: current.animationSeconds,
                isCutOpen: isCloseUp && !!current.summary && isCutOpenByBodyId[current.summary.id],
                scale: bodyScale,
                renderer,
            });
            current.view.sunModel?.update({
                daysSinceJ2000: getDaysSinceJ2000(current.simulationMilliseconds),
                animationSeconds: current.animationSeconds,
                scale: bodyScale,
                cameraPosition: camera.position,
                glow,
                renderer,
            });
            if (towardSun) {
                current.view.magnetosphereModel?.update({
                    towardSun,
                    conditions,
                    animationSeconds: current.animationSeconds,
                    frameSeconds,
                    resolution: drawingBufferSize,
                    pixelRatio: renderer.getPixelRatio(),
                });
            }
        }
        renderer.render(scene, camera);

        current.secondsSinceReadout += frameSeconds;
        if (current.secondsSinceReadout >= readoutIntervalSeconds) {
            current.secondsSinceReadout = 0;
            current.onReadout?.({
                unixMilliseconds: current.simulationMilliseconds,
                conditions,
            });
        }
    }

    renderer.setAnimationLoop(renderFrame);

    return {
        canvas: renderer.domElement,
        /** Fires when tapping the body picks a layer, or `undefined` when a tap clears it. */
        listenToPick(onPick: (pick: Readonly<BodyPick> | undefined) => void) {
            current.onPick = onPick;
        },
        /** Fires when tapping a body beside the focused one, or the focused one when zoomed out. */
        listenToBodyTap(onBodyTap: (bodyId: BodyId) => void) {
            current.onBodyTap = onBodyTap;
        },
        /** Fires when zooming crosses into another scale. */
        listenToFocusScale(onFocusScale: (focusScale: FocusScale) => void) {
            current.onFocusScale = onFocusScale;
        },
        listenToReadout(onReadout: (readout: Readonly<SceneReadout>) => void) {
            current.onReadout = onReadout;
        },
        /** Only fires for changes the scene makes itself, not for `setRenderQuality`. */
        listenToRenderQuality(onRenderQualityChange: (quality: Readonly<RenderQuality>) => void) {
            current.onRenderQualityChange = onRenderQualityChange;
        },
        setRenderQuality(quality: Readonly<RenderQuality>) {
            qualityScaler.setQuality(quality);
        },
        setBody({details, assets}: Readonly<{details: Readonly<BodyDetails>; assets: BodyAssets}>) {
            if (current.details === details) {
                return;
            }
            const previousSummary = current.summary;
            current.summary = assertWrap.isDefined(bodyCatalog[details.id]);
            current.details = details;
            current.assets = assets;
            current.pendingBodyId = undefined;
            rebuildView(previousSummary);
        },
        setSelectedLayer(layerId: string | undefined) {
            if (layerId !== current.selectedLayerId) {
                setSelectedLayer(layerId);
            }
        },
        setStars(stars: ReadonlyArray<Readonly<Star>>) {
            sky.setStars(stars);
        },
        /** From 0 to 1. */
        setMagneticFieldOpacity(opacity: number) {
            current.magneticFieldOpacity = opacity;
            current.view?.magnetosphereModel?.setFieldOpacity(opacity * current.magnetosphereFade);
        },
        /**
         * Flies the camera to the scale's distance when it changes, unless the camera is already in
         * that scale. Before any body is shown, it jumps there instead.
         */
        setFocusScale(focusScale: FocusScale) {
            if (focusScale === current.requestedFocusScale) {
                return;
            }
            current.requestedFocusScale = focusScale;
            /** The flight to a tapped body starts once its view is built. */
            if (current.pendingBodyId || focusScale === current.focusScale) {
                return;
            }
            const endDistanceKm = focusScaleDistancesKm[focusScale](
                current.summary ?? bodyCatalog[BodyId.Earth],
            );
            if (current.view) {
                startCameraFlight({
                    startTarget: controls.target,
                    startPosition: camera.position,
                    startUp: camera.up,
                    endDistanceKm,
                    isToSunSide: focusScale === FocusScale.Body,
                });
            } else {
                camera.position.setLength(endDistanceKm);
                current.focusScale = getDistanceFocusScale();
            }
        },
        /** How many times faster than real time the shown time runs. */
        setTimeSpeed(speed: number) {
            current.timeSpeed = speed;
        },
        resize({width, height}: Readonly<{width: number; height: number}>) {
            if (!width || !height) {
                return;
            }
            renderer.setSize(width, height, false);
            updateProjection();
        },
        setRightInset(pixels: number) {
            current.rightInsetPixels = pixels;
            /** The first inset applies at once, so the first view doesn't slide into place. */
            current.shownInsetPixels ??= pixels;
            updateProjection();
        },
        /** Stops and restarts drawing frames, keeping everything else as is. */
        setPaused(isPaused: boolean) {
            if (isPaused === frameClock.isPaused) {
                return;
            }
            frameClock.isPaused = isPaused;
            /** Otherwise the first frame after resuming counts the whole pause as its duration. */
            frameClock.lastMilliseconds = undefined;
            renderer.setAnimationLoop(isPaused ? null : renderFrame);
        },
        dispose() {
            renderer.setAnimationLoop(null);
            window.removeEventListener('pointerdown', forgetStalePointers, {
                capture: true,
            });
            controls.dispose();
            current.view?.dispose();
            sky.dispose();
            renderer.dispose();
        },
    };
}

export type CosmosScene = ReturnType<typeof createCosmosScene>;
