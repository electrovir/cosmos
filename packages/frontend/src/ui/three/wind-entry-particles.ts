// cspell:words footward lerp nightside smootherstep
import {assertWrap} from '@augment-vir/assert';
import {createArray, removeDuplicates} from '@augment-vir/common';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    MathUtils,
    Points,
    type Quaternion,
    ShaderMaterial,
    Vector3,
} from 'three';
import {type FieldLine, type FieldLineSeed} from '../../physics/magnetosphere.js';

/** How a solar wind particle gets past the magnetopause. */
enum EntryRoute {
    /** Onto an open dayside line at the high-latitude magnetopause, then down into a polar cusp. */
    Cusp = 'cusp',
    /**
     * Swept down the tail into a lobe, carried in to the plasma sheet, then thrown back toward the
     * planet along a closed nightside line into the auroral oval.
     */
    Tail = 'tail',
}

enum EntryStage {
    Wind = 'wind',
    /** From where it leaves the wind to the point where it joins its field line. */
    Join = 'join',
    Line = 'line',
    /** A flash where it hits the upper atmosphere. */
    Landed = 'landed',
}

/**
 * The tail's convection and reconnection really take hours, so the join and line legs are sped up
 * to watchable lengths. The wind leg moves at the wind's own speed.
 */
const routeTimings: Record<
    EntryRoute,
    {
        /** Where along x the particle leaves the wind, relative to where it joins its line. */
        leaveOffsetX: number;
        joinSeconds: number;
        lineSeconds: number;
    }
> = {
    [EntryRoute.Cusp]: {
        leaveOffsetX: 1.5,
        joinSeconds: 1,
        lineSeconds: 2.5,
    },
    [EntryRoute.Tail]: {
        leaveOffsetX: -8,
        joinSeconds: 4,
        lineSeconds: 3,
    },
};

const particleCount = 160;
const landedSeconds = 1.2;
/** Particles fade in over this many planet radii after appearing upstream. */
const fadeInRadii = 6;

const vertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>

    uniform float pointSize;

    attribute float capture;
    attribute float alpha;
    attribute float size;

    varying float vCapture;
    varying float vAlpha;

    void main() {
        vCapture = capture;
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize * size;
        #include <logdepthbuf_vertex>
    }
`;

const fragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>

    uniform float brightness;

    varying float vCapture;
    varying float vAlpha;

    void main() {
        #include <logdepthbuf_fragment>
        float distanceFromCenter = length(gl_PointCoord - 0.5);
        if (distanceFromCenter > 0.5 || vAlpha <= 0.0) {
            discard;
        }
        vec3 color = mix(vec3(1.0, 0.55, 0.25), vec3(0.55, 1.0, 0.75), vCapture);
        gl_FragColor = vec4(
            color * vAlpha * (1.0 - distanceFromCenter * 2.0) * brightness,
            1.0
        );
    }
`;

type EntryLine = {
    route: EntryRoute;
    /** From where particles join the line down to its foot, in planet radii, magnetosphere frame. */
    points: Vector3[];
};

type EntryParticle = {
    route: EntryRoute;
    lineIndex: number;
    stage: EntryStage;
    stageSeconds: number;
    /** Angle around the planet-Sun line, from the wind frame's y toward its z. */
    angle: number;
    /** How far outside the magnetopause its streamline runs, like the wind shader's seed radius. */
    streamlineRadius: number;
    x: number;
    leaveX: number;
    /** In drawn kilometers in the wind frame. */
    joinStart: Vector3;
};

/**
 * Solar wind particles that get into the magnetosphere: each rides the wind like the others, then
 * leaves it to follow a field line down to the planet, through a polar cusp or by way of the tail.
 */
export function createWindEntryParticles({
    random,
    windStartX,
    toDisplayPoint,
}: Readonly<{
    random: () => number;
    /** Where wind particles appear, in planet radii toward the Sun. */
    windStartX: number;
    /** Planet radii to drawn kilometers. */
    toDisplayPoint: (point: Readonly<Vector3>) => Vector3;
}>) {
    const positions = new Float32Array(particleCount * 3);
    const captures = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('capture', new BufferAttribute(captures, 1));
    geometry.setAttribute('alpha', new BufferAttribute(alphas, 1));
    geometry.setAttribute('size', new BufferAttribute(sizes, 1));
    const uniforms = {
        pointSize: {
            value: 3,
        },
        brightness: {
            value: 1,
        },
    };
    const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;

    const current: {
        /** Indexed like the traced lines, undefined for lines no route uses. */
        entryLines: (EntryLine | undefined)[];
        particles: (EntryParticle | undefined)[];
    } = {
        entryLines: [],
        particles: createArray(particleCount, () => undefined),
    };

    function getLinePoint({
        line,
        progress,
        gsmToWind,
    }: Readonly<{
        line: Readonly<EntryLine>;
        progress: number;
        gsmToWind: Readonly<Quaternion>;
    }>) {
        const index = progress * (line.points.length - 1);
        const lower = assertWrap.isDefined(line.points[Math.floor(index)]);
        const upper = line.points[Math.ceil(index)] ?? lower;
        return toDisplayPoint(
            lower
                .clone()
                .lerp(upper, index - Math.floor(index))
                .applyQuaternion(gsmToWind),
        );
    }

    function startParticle(gsmToWind: Readonly<Quaternion>) {
        const candidates = current.entryLines
            .map((line, lineIndex) => {
                return {
                    line,
                    lineIndex,
                };
            })
            .filter(
                (candidate): candidate is {line: EntryLine; lineIndex: number} => !!candidate.line,
            );
        const routes = removeDuplicates(candidates.map((candidate) => candidate.line.route));
        const route = routes[Math.floor(random() * routes.length)];
        const routeCandidates = candidates.filter((candidate) => candidate.line.route === route);
        const chosen = routeCandidates[Math.floor(random() * routeCandidates.length)];
        if (!chosen) {
            return undefined;
        }
        const join = assertWrap.isDefined(chosen.line.points[0]).clone().applyQuaternion(gsmToWind);
        const foot = assertWrap
            .isDefined(chosen.line.points.at(-1))
            .clone()
            .applyQuaternion(gsmToWind);
        /**
         * Cusp particles meet the magnetopause right where their line leaves it. Tail particles
         * enter the lobe on their foot's side, well away from where their line peaks in the plasma
         * sheet.
         */
        const angle =
            chosen.line.route === EntryRoute.Cusp
                ? Math.atan2(join.z, join.y)
                : Math.sign(foot.z) * (Math.PI / 2) + (random() - 0.5) * 1.2;
        return {
            route: chosen.line.route,
            lineIndex: chosen.lineIndex,
            stage: EntryStage.Wind,
            stageSeconds: 0,
            angle,
            streamlineRadius: 0.3 + random() * 1.2,
            x: windStartX,
            leaveX: Math.min(windStartX, join.x + routeTimings[chosen.line.route].leaveOffsetX),
            joinStart: new Vector3(),
        };
    }

    function getWindPoint({
        particle,
        getMagnetopauseRadius,
    }: Readonly<{
        particle: Readonly<EntryParticle>;
        getMagnetopauseRadius: (x: number) => number;
    }>) {
        const radius = Math.hypot(particle.streamlineRadius, getMagnetopauseRadius(particle.x));
        return toDisplayPoint(
            new Vector3(
                particle.x,
                radius * Math.cos(particle.angle),
                radius * Math.sin(particle.angle),
            ),
        );
    }

    /** Moves a particle along its route, or ends it once it reaches the ground. */
    function advanceParticle({
        particle,
        frameSeconds,
        windSpeedRadii,
        getMagnetopauseRadius,
        isFootHidden,
    }: Readonly<{
        particle: Readonly<EntryParticle>;
        frameSeconds: number;
        windSpeedRadii: number;
        getMagnetopauseRadius: (x: number) => number;
        isFootHidden: (foot: Readonly<Vector3>) => boolean;
    }>) {
        const stageSeconds = particle.stageSeconds + frameSeconds;
        if (particle.stage === EntryStage.Wind) {
            const x = particle.x - windSpeedRadii * frameSeconds;
            return x > particle.leaveX
                ? {
                      ...particle,
                      x,
                      stageSeconds,
                  }
                : {
                      ...particle,
                      x,
                      stage: EntryStage.Join,
                      stageSeconds: 0,
                      joinStart: getWindPoint({
                          particle,
                          getMagnetopauseRadius,
                      }),
                  };
        }
        const timing = routeTimings[particle.route];
        if (particle.stage === EntryStage.Join) {
            return stageSeconds < timing.joinSeconds
                ? {
                      ...particle,
                      stageSeconds,
                  }
                : {
                      ...particle,
                      stage: EntryStage.Line,
                      stageSeconds: 0,
                  };
        } else if (particle.stage === EntryStage.Line) {
            return stageSeconds < timing.lineSeconds
                ? {
                      ...particle,
                      stageSeconds,
                  }
                : isFootHidden(
                        assertWrap.isDefined(current.entryLines[particle.lineIndex]?.points.at(-1)),
                    )
                  ? undefined
                  : {
                        ...particle,
                        stage: EntryStage.Landed,
                        stageSeconds: 0,
                    };
        } else {
            return stageSeconds < landedSeconds
                ? {
                      ...particle,
                      stageSeconds,
                  }
                : undefined;
        }
    }

    function placeParticle({
        particle,
        particleIndex,
        gsmToWind,
        getMagnetopauseRadius,
    }: Readonly<{
        particle: Readonly<EntryParticle>;
        particleIndex: number;
        gsmToWind: Readonly<Quaternion>;
        getMagnetopauseRadius: (x: number) => number;
    }>) {
        const line = assertWrap.isDefined(current.entryLines[particle.lineIndex]);
        const timing = routeTimings[particle.route];
        const placement: Record<
            EntryStage,
            () => {
                position: Vector3;
                capture: number;
                size: number;
                alpha: number;
            }
        > = {
            [EntryStage.Wind]() {
                return {
                    position: getWindPoint({
                        particle,
                        getMagnetopauseRadius,
                    }),
                    capture: 0,
                    size: 1,
                    alpha: Math.min(1, (windStartX - particle.x) / fadeInRadii),
                };
            },
            [EntryStage.Join]() {
                const progress = MathUtils.smootherstep(
                    particle.stageSeconds,
                    0,
                    timing.joinSeconds,
                );
                return {
                    position: particle.joinStart.clone().lerp(
                        getLinePoint({
                            line,
                            progress: 0,
                            gsmToWind,
                        }),
                        progress,
                    ),
                    capture: progress,
                    size: 1,
                    alpha: 1,
                };
            },
            [EntryStage.Line]() {
                /** Speeds up as it falls toward the planet. */
                const progress = (particle.stageSeconds / timing.lineSeconds) ** 2;
                return {
                    position: getLinePoint({
                        line,
                        progress,
                        gsmToWind,
                    }),
                    capture: 1,
                    size: 1,
                    alpha: 1,
                };
            },
            [EntryStage.Landed]() {
                const progress = particle.stageSeconds / landedSeconds;
                return {
                    position: getLinePoint({
                        line,
                        progress: 1,
                        gsmToWind,
                    }),
                    capture: 1,
                    size: 1 + 5 * Math.sqrt(progress),
                    alpha: (1 - progress) ** 2,
                };
            },
        };
        const {position, capture, size, alpha} = placement[particle.stage]();
        positions.set(
            [
                position.x,
                position.y,
                position.z,
            ],
            particleIndex * 3,
        );
        captures[particleIndex] = capture;
        alphas[particleIndex] = alpha;
        sizes[particleIndex] = size;
    }

    return {
        /** Drawn in the wind frame: x toward the Sun and z level with the planet's north. */
        points,
        /** Picks out the lines particles can enter along from a freshly traced set. */
        setLines({
            lines,
            seeds,
            north,
        }: Readonly<{
            /** In planet radii, in the magnetosphere frame. */
            lines: ReadonlyArray<Readonly<FieldLine>>;
            seeds: ReadonlyArray<Readonly<FieldLineSeed>>;
            /** The magnetic north pole's direction in the magnetosphere frame. */
            north: Readonly<Vector3>;
        }>) {
            current.entryLines = lines.map((line, lineIndex): EntryLine | undefined => {
                const footward = assertWrap.isDefined(seeds[lineIndex]).isNorth
                    ? line.points
                    : line.points.toReversed();
                const foot = assertWrap.isDefined(footward.at(-1));
                const farIndex = footward.reduce((farthest, point, index) => {
                    return point.length() > assertWrap.isDefined(footward[farthest]).length()
                        ? index
                        : farthest;
                }, 0);
                const far = assertWrap.isDefined(footward[farIndex]);
                const footLatitudeDegrees = MathUtils.radToDeg(
                    Math.abs(Math.asin(foot.clone().normalize().dot(north))),
                );
                const route =
                    !line.isClosed && foot.x > 0 && far.x > -5 && footLatitudeDegrees >= 70
                        ? EntryRoute.Cusp
                        : line.isClosed && foot.x < 0 && far.x < -6
                          ? EntryRoute.Tail
                          : undefined;
                return route
                    ? {
                          route,
                          points: footward.slice(farIndex),
                      }
                    : undefined;
            });
            current.particles = current.particles.map((particle) => {
                return particle && current.entryLines[particle.lineIndex]?.route === particle.route
                    ? particle
                    : undefined;
            });
        },
        setBrightness(brightness: number) {
            uniforms.brightness.value = brightness;
        },
        update({
            frameSeconds,
            windSpeedRadii,
            activity,
            gsmToWind,
            getMagnetopauseRadius,
            isFootHidden,
            pixelRatio,
        }: Readonly<{
            frameSeconds: number;
            /** The wind particles' speed, in planet radii per second. */
            windSpeedRadii: number;
            activity: number;
            /** Turns magnetosphere-frame points into the wind frame. */
            gsmToWind: Readonly<Quaternion>;
            /** The magnetopause's distance from the planet-Sun line at an x, in planet radii. */
            getMagnetopauseRadius: (x: number) => number;
            /**
             * Whether a line foot, in planet radii in the magnetosphere frame, is out of view.
             * Particles headed there vanish instead of landing.
             */
            isFootHidden: (foot: Readonly<Vector3>) => boolean;
            pixelRatio: number;
        }>) {
            /** Each waiting particle's chance per second of setting off. */
            const startRate = 0.01 + 0.12 * activity;
            current.particles = current.particles.map((particle) => {
                return particle
                    ? advanceParticle({
                          particle,
                          frameSeconds,
                          windSpeedRadii,
                          getMagnetopauseRadius,
                          isFootHidden,
                      })
                    : random() < startRate * frameSeconds
                      ? startParticle(gsmToWind)
                      : undefined;
            });
            current.particles.forEach((particle, particleIndex) => {
                if (particle) {
                    placeParticle({
                        particle,
                        particleIndex,
                        gsmToWind,
                        getMagnetopauseRadius,
                    });
                } else {
                    alphas[particleIndex] = 0;
                }
            });
            [
                'position',
                'capture',
                'alpha',
                'size',
            ].forEach((name) => {
                geometry.getAttribute(name).needsUpdate = true;
            });
            uniforms.pointSize.value = 3 * pixelRatio;
            /**
             * Where particles hit the ground this frame, in planet radii in the magnetosphere
             * frame.
             */
            return current.particles
                .filter((particle) => {
                    return particle?.stage === EntryStage.Landed && !particle.stageSeconds;
                })
                .map((particle) => {
                    return assertWrap
                        .isDefined(
                            current.entryLines[assertWrap.isDefined(particle).lineIndex]?.points.at(
                                -1,
                            ),
                        )
                        .clone();
                });
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
