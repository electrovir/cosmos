// cspell:words footpoints kutta runge shue
import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {Vector3} from 'three';

/**
 * A simple model of a planet's magnetosphere, in planet radii, in a frame like the geocentric solar
 * magnetospheric (GSM) frame: +x toward the Sun, +z toward the magnetic north pole's side (with the
 * dipole's tilt staying in the x-z plane), and +y toward dusk.
 */
export type Magnetosphere = {
    /** The GSM axes expressed in the body's own frame. */
    axes: Readonly<{
        x: Vector3;
        y: Vector3;
        z: Vector3;
    }>;
    /** The dipole moment in GSM, sized so that it gives the surface field at the magnetic equator. */
    dipoleMoment: Vector3;
    magnetopause: Readonly<BoundaryShape>;
    bowShock: Readonly<BoundaryShape>;
    /** The field in each lobe of the magnetotail, far down the tail. */
    tailFieldNanotesla: number;
};

/**
 * The surface shape from Shue et al. 1998: `r = standoff * (2 / (1 + cos θ)) ^ flaring`, where `θ`
 * is the angle from the planet-Sun line. With `flaring` at or above 0.5 the surface never closes
 * behind the planet.
 */
export type BoundaryShape = {
    standoff: number;
    flaring: number;
};

export function getMagnetopauseShape({
    dynamicPressureNanopascals,
    fieldZNanotesla,
}: Readonly<{
    dynamicPressureNanopascals: number;
    fieldZNanotesla: number;
}>) {
    return {
        standoff:
            (10.22 + 1.29 * Math.tanh(0.184 * (fieldZNanotesla + 8.14))) *
            dynamicPressureNanopascals ** (-1 / 6.6),
        flaring:
            (0.58 - 0.007 * fieldZNanotesla) * (1 + 0.024 * Math.log(dynamicPressureNanopascals)),
    };
}

/** The distance from the planet's center to the boundary at an angle from the planet-Sun line. */
export function getBoundaryRadius({
    shape,
    angleFromSunRadians,
}: Readonly<{
    shape: Readonly<BoundaryShape>;
    angleFromSunRadians: number;
}>) {
    return shape.standoff * (2 / (1 + Math.cos(angleFromSunRadians))) ** shape.flaring;
}

export function isInsideBoundary({
    shape,
    point,
}: Readonly<{
    shape: Readonly<BoundaryShape>;
    point: Readonly<Vector3>;
}>) {
    const distance = point.length();
    return (
        !distance ||
        distance <
            getBoundaryRadius({
                shape,
                angleFromSunRadians: Math.acos(point.x / distance),
            })
    );
}

/**
 * The boundary's distance from the planet-Sun line at evenly spaced `x` values from `maxX` down to
 * `minX`, or 0 sunward of the boundary's nose.
 */
export function getBoundaryCylinderRadii({
    shape,
    minX,
    maxX,
    count,
}: Readonly<{
    shape: Readonly<BoundaryShape>;
    minX: number;
    maxX: number;
    count: number;
}>) {
    return createArray(count, (index) => {
        const x = maxX - ((maxX - minX) * index) / (count - 1);
        if (x >= shape.standoff) {
            return 0;
        }
        /** `x` falls steadily as the angle grows, so bisection finds the angle reaching it. */
        const angle = createArray(50, () => 0).reduce(
            (range) => {
                const middle = (range.low + range.high) / 2;
                const middleX =
                    getBoundaryRadius({
                        shape,
                        angleFromSunRadians: middle,
                    }) * Math.cos(middle);
                return middleX > x
                    ? {
                          low: middle,
                          high: range.high,
                      }
                    : {
                          low: range.low,
                          high: middle,
                      };
            },
            {
                low: 0,
                high: Math.PI * 0.999,
            },
        ).low;
        return (
            getBoundaryRadius({
                shape,
                angleFromSunRadians: angle,
            }) * Math.sin(angle)
        );
    });
}

export function createMagnetosphere({
    sunDirection,
    magneticNorth,
    surfaceFieldNanotesla,
    dynamicPressureNanopascals,
    fieldZNanotesla,
}: Readonly<{
    /** In the body's frame. */
    sunDirection: Readonly<Vector3>;
    /** The northern magnetic pole's direction in the body's frame. */
    magneticNorth: Readonly<Vector3>;
    surfaceFieldNanotesla: number;
    dynamicPressureNanopascals: number;
    /** The solar wind's north-south field. */
    fieldZNanotesla: number;
}>) {
    const x = sunDirection.clone().normalize();
    const z = magneticNorth.clone().addScaledVector(x, -magneticNorth.dot(x)).normalize();
    const y = z.clone().cross(x);
    const magnetopause = getMagnetopauseShape({
        dynamicPressureNanopascals,
        fieldZNanotesla,
    });
    return {
        axes: {
            x,
            y,
            z,
        },
        /**
         * The geomagnetic north pole is the dipole's south end: field lines go into the ground
         * there.
         */
        dipoleMoment: new Vector3(magneticNorth.dot(x), 0, magneticNorth.dot(z))
            .normalize()
            .multiplyScalar(-surfaceFieldNanotesla),
        magnetopause,
        bowShock: {
            standoff: magnetopause.standoff * 1.3,
            flaring: 0.8,
        },
        tailFieldNanotesla: 20 * Math.sqrt(dynamicPressureNanopascals / 2),
    };
}

export function bodyToMagnetosphereFrame({
    magnetosphere,
    point,
}: Readonly<{
    magnetosphere: Readonly<Pick<Magnetosphere, 'axes'>>;
    point: Readonly<Vector3>;
}>) {
    return new Vector3(
        point.dot(magnetosphere.axes.x),
        point.dot(magnetosphere.axes.y),
        point.dot(magnetosphere.axes.z),
    );
}

export function magnetosphereToBodyFrame({
    magnetosphere,
    point,
}: Readonly<{
    magnetosphere: Readonly<Pick<Magnetosphere, 'axes'>>;
    point: Readonly<Vector3>;
}>) {
    return new Vector3()
        .addScaledVector(magnetosphere.axes.x, point.x)
        .addScaledVector(magnetosphere.axes.y, point.y)
        .addScaledVector(magnetosphere.axes.z, point.z);
}

function getDipoleField({
    moment,
    offset,
}: Readonly<{
    moment: Readonly<Vector3>;
    /** From the dipole to the field point. */
    offset: Readonly<Vector3>;
}>) {
    const distance = offset.length();
    const direction = offset.clone().divideScalar(distance);
    return direction
        .multiplyScalar(3 * moment.dot(direction))
        .sub(moment)
        .divideScalar(distance ** 3);
}

/**
 * The field in nanoteslas at a point in the magnetosphere frame. Three parts: the planet's dipole;
 * a mirror-image dipole beyond the magnetopause's nose, standing in for the currents on the
 * magnetopause (Chapman-Ferraro) by cancelling the field crossing the nose; and the two
 * opposite-pointing lobes the solar wind drags out into the tail.
 */
export function getMagneticField({
    magnetosphere,
    point,
}: Readonly<{
    magnetosphere: Readonly<Magnetosphere>;
    point: Readonly<Vector3>;
}>) {
    const moment = magnetosphere.dipoleMoment;
    const imagePosition = new Vector3(2 * magnetosphere.magnetopause.standoff, 0, 0);
    const imageMoment = moment.clone().setX(-moment.x);
    const tailStrength = 0.5 * (1 - Math.tanh((point.x + 10) / 4));
    return getDipoleField({
        moment,
        offset: point,
    })
        .add(
            getDipoleField({
                moment: imageMoment,
                offset: point.clone().sub(imagePosition),
            }),
        )
        .add(
            new Vector3(
                magnetosphere.tailFieldNanotesla * Math.tanh(point.z / 2) * tailStrength,
                0,
                0,
            ),
        );
}

export type FieldLine = {
    /** In body radii, ordered in the direction the field points. */
    points: Vector3[];
    /** Whether both ends reach the planet, rather than one end leaving into the solar wind. */
    isClosed: boolean;
};

/** Where a traced field line ends up when it leaves the planet. */
enum TraceEnd {
    Planet = 'planet',
    Away = 'away',
}

const maxTraceSteps = 2000;
const tailEndX = -80;

/**
 * Follows the field from a point with fourth-order Runge-Kutta steps, which shrink near the planet
 * where the field bends sharply, until the line comes back down to the planet, leaves the
 * magnetopause, or reaches far down the tail.
 */
export function traceFieldLine({
    magnetosphere,
    start,
    isAlongField,
}: Readonly<{
    magnetosphere: Readonly<Magnetosphere>;
    /** In the magnetosphere frame. */
    start: Readonly<Vector3>;
    /** Whether to follow the field's direction, rather than go against it. */
    isAlongField: boolean;
}>) {
    const sign = isAlongField ? 1 : -1;

    function getDirection(point: Readonly<Vector3>) {
        return getMagneticField({
            magnetosphere,
            point,
        })
            .normalize()
            .multiplyScalar(sign);
    }

    function step(point: Readonly<Vector3>) {
        const stepSize = Math.min(2, Math.max(0.01, 0.03 * point.length()));
        const k1 = getDirection(point);
        const k2 = getDirection(point.clone().addScaledVector(k1, stepSize / 2));
        const k3 = getDirection(point.clone().addScaledVector(k2, stepSize / 2));
        const k4 = getDirection(point.clone().addScaledVector(k3, stepSize));
        return point
            .clone()
            .addScaledVector(
                k1.add(k2.multiplyScalar(2)).add(k3.multiplyScalar(2)).add(k4),
                stepSize / 6,
            );
    }

    /** A loop, because a line can take thousands of steps and recursion would overflow the stack. */
    const points = [start.clone()];
    while (points.length <= maxTraceSteps) {
        const next = step(assertWrap.isDefined(points.at(-1)));
        if (next.length() < 1 && points.length > 1) {
            points.push(next.normalize());
            return {
                points,
                end: TraceEnd.Planet,
            };
        }
        points.push(next);
        if (
            next.x < tailEndX ||
            !isInsideBoundary({
                shape: magnetosphere.magnetopause,
                point: next,
            })
        ) {
            break;
        }
    }
    return {
        points,
        end: TraceEnd.Away,
    };
}

/** Magnetic latitudes of the field lines' footpoints, in degrees. */
const footLatitudesDegrees = [
    20,
    30,
    40,
    50,
    55,
    60,
    65,
    70,
    75,
    80,
];
const footLongitudeCount = 8;

export type FieldLineSeed = {
    /** On the planet's surface, in the magnetosphere frame. */
    start: Vector3;
    isNorth: boolean;
};

/**
 * Footpoints spread over both hemispheres, at magnetic latitudes and at evenly spaced angles around
 * the magnetic pole from noon.
 */
export function getFieldLineSeeds(magnetosphere: Readonly<Pick<Magnetosphere, 'dipoleMoment'>>) {
    const north = magnetosphere.dipoleMoment.clone().normalize().negate();
    const noon = new Vector3(1, 0, 0).addScaledVector(north, -north.x).normalize();
    const dusk = north.clone().cross(noon);

    return [
        true,
        false,
    ].flatMap((isNorth) => {
        return footLatitudesDegrees.flatMap((latitudeDegrees) => {
            return createArray(footLongitudeCount, (longitudeIndex): FieldLineSeed => {
                const latitude = (latitudeDegrees * Math.PI) / 180;
                const longitude = (2 * Math.PI * longitudeIndex) / footLongitudeCount;
                return {
                    start: noon
                        .clone()
                        .multiplyScalar(Math.cos(latitude) * Math.cos(longitude))
                        .addScaledVector(dusk, Math.cos(latitude) * Math.sin(longitude))
                        .addScaledVector(north, (isNorth ? 1 : -1) * Math.sin(latitude)),
                    isNorth,
                };
            });
        });
    });
}

/** Traces one seed's line, with points in the magnetosphere frame. */
export function traceSeededFieldLine({
    magnetosphere,
    seed,
}: Readonly<{
    magnetosphere: Readonly<Magnetosphere>;
    seed: Readonly<FieldLineSeed>;
}>): FieldLine {
    /** The field leaves the ground in the south and enters it in the north. */
    const trace = traceFieldLine({
        magnetosphere,
        start: seed.start,
        isAlongField: !seed.isNorth,
    });
    return {
        points: seed.isNorth ? trace.points.toReversed() : trace.points,
        isClosed: trace.end === TraceEnd.Planet,
    };
}

/** Traces every seed from {@link getFieldLineSeeds}, with points in the body's frame. */
export function traceFieldLines(magnetosphere: Readonly<Magnetosphere>) {
    return getFieldLineSeeds(magnetosphere).map((seed): FieldLine => {
        const line = traceSeededFieldLine({
            magnetosphere,
            seed,
        });
        return {
            ...line,
            points: line.points.map((point) => {
                return magnetosphereToBodyFrame({
                    magnetosphere,
                    point,
                });
            }),
        };
    });
}
