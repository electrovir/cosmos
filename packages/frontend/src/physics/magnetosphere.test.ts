// cspell:words shue
import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {Vector3} from 'three';
import {
    bodyToMagnetosphereFrame,
    createMagnetosphere,
    getBoundaryCylinderRadii,
    getMagneticField,
    getMagnetopauseShape,
    isInsideBoundary,
    magnetosphereToBodyFrame,
    traceFieldLine,
    traceFieldLines,
} from './magnetosphere.js';

const magnetosphere = createMagnetosphere({
    sunDirection: new Vector3(0, 0, -3),
    magneticNorth: new Vector3(0, 1, 0.2).normalize(),
    surfaceFieldNanotesla: 30_000,
    dynamicPressureNanopascals: 2,
    fieldZNanotesla: 0,
});

describe(getMagnetopauseShape.name, () => {
    it('stands about 10 planet radii sunward for typical wind', () => {
        const shape = getMagnetopauseShape({
            dynamicPressureNanopascals: 2,
            fieldZNanotesla: 0,
        });
        assert.isApproximately(shape.standoff, 10.25, 0.01);
        assert.isApproximately(shape.flaring, 0.59, 0.01);
    });
    it('is pushed closer by stronger wind and southward field', () => {
        assert.isBelow(
            getMagnetopauseShape({
                dynamicPressureNanopascals: 10,
                fieldZNanotesla: -15,
            }).standoff,
            7,
        );
    });
});

describe(isInsideBoundary.name, () => {
    it('separates inside from outside', () => {
        assert.deepEquals(
            [
                new Vector3(0, 0, 0),
                new Vector3(9, 0, 0),
                new Vector3(11, 0, 0),
                new Vector3(-50, 10, 0),
            ].map((point) => {
                return isInsideBoundary({
                    shape: magnetosphere.magnetopause,
                    point,
                });
            }),
            [
                true,
                true,
                false,
                true,
            ],
        );
    });
});

describe(getBoundaryCylinderRadii.name, () => {
    it('is 0 sunward of the nose and widens down the tail', () => {
        const radii = getBoundaryCylinderRadii({
            shape: magnetosphere.bowShock,
            minX: -40,
            maxX: 20,
            count: 7,
        });
        assert.strictEquals(radii[0], 0);
        radii.slice(2).forEach((radius, index) => {
            assert.isAbove(radius, assertWrap.isDefined(radii[index + 1]));
        });
        /** At x = 0 the Shue shape's radius is `standoff * 2 ^ flaring`. */
        assert.isApproximately(
            assertWrap.isDefined(radii[2]),
            magnetosphere.bowShock.standoff * 2 ** magnetosphere.bowShock.flaring,
            0.01,
        );
    });
});

describe(createMagnetosphere.name, () => {
    it('round trips between frames', () => {
        const point = new Vector3(1, 2, 3);
        assert.isBelow(
            magnetosphereToBodyFrame({
                magnetosphere,
                point: bodyToMagnetosphereFrame({
                    magnetosphere,
                    point,
                }),
            }).distanceTo(point),
            1e-12,
        );
    });
});

describe(getMagneticField.name, () => {
    const north = new Vector3(0, 0, 0).sub(magnetosphere.dipoleMoment).normalize();

    it('matches the surface field at the magnetic equator', () => {
        const equator = new Vector3(0, 1, 0);
        assert.isApproximately(
            getMagneticField({
                magnetosphere,
                point: equator,
            }).length(),
            30_000,
            300,
        );
    });
    it('points into the ground at the magnetic north pole', () => {
        assert.isBelow(
            getMagneticField({
                magnetosphere,
                point: north,
            }).dot(north),
            0,
        );
    });
    it('does not cross the magnetopause at its nose', () => {
        const nose = new Vector3(magnetosphere.magnetopause.standoff, 3, 2);
        const field = getMagneticField({
            magnetosphere,
            point: nose,
        });
        assert.isBelow(Math.abs(field.x), field.length() * 0.01);
    });
    it('points sunward in the northern tail lobe', () => {
        assert.isAbove(
            getMagneticField({
                magnetosphere,
                point: new Vector3(-30, 0, 5),
            }).x,
            0,
        );
    });
});

describe(traceFieldLine.name, () => {
    it('closes a low-latitude line near the equator', () => {
        const latitude = Math.PI / 6;
        const trace = traceFieldLine({
            magnetosphere: createMagnetosphere({
                sunDirection: new Vector3(1, 0, 0),
                magneticNorth: new Vector3(0, 0, 1),
                surfaceFieldNanotesla: 30_000,
                dynamicPressureNanopascals: 2,
                fieldZNanotesla: 0,
            }),
            start: new Vector3(0, -Math.cos(latitude), -Math.sin(latitude)),
            isAlongField: true,
        });
        const end = assertWrap.isDefined(trace.points.at(-1));
        const apex = Math.max(...trace.points.map((point) => point.length()));
        /** A dipole line reaches `1 / cos²(latitude)` at the equator. */
        assert.isApproximately(apex, 1 / Math.cos(latitude) ** 2, 0.02);
        assert.isApproximately(end.z, Math.sin(latitude), 0.02);
    });
});

describe(traceFieldLines.name, () => {
    const lines = traceFieldLines(magnetosphere);

    it('closes low-latitude lines and opens high-latitude ones', () => {
        assert.isLengthExactly(lines, 160);
        assert.isTrue(lines.slice(0, 8).every((line) => line.isClosed));
        assert.isTrue(lines.slice(72, 80).some((line) => !line.isClosed));
    });
    it('orders points along the field', () => {
        const line = assertWrap.isDefined(lines[0]);
        const [
            first,
            second,
        ] = line.points;
        assert.isDefined(first);
        assert.isDefined(second);
        const field = getMagneticField({
            magnetosphere,
            point: bodyToMagnetosphereFrame({
                magnetosphere,
                point: first,
            }),
        });
        const stepDirection = bodyToMagnetosphereFrame({
            magnetosphere,
            point: second.clone().sub(first),
        });
        assert.isAbove(field.dot(stepDirection), 0);
    });
});
