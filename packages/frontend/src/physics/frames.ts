import {Matrix4, Quaternion, Vector3} from 'three';
import {type BodyRotation} from '../data/celestial-body.js';
import {degreesToRadians, radiansToDegrees} from './angles.js';

/** The tilt of Earth's equator against the ecliptic at J2000, which turns the equatorial frame. */
const obliquityRadians = degreesToRadians(23.4392811);

/**
 * Converts from an astronomy frame (z toward north) to the scene's frame (y up, as three.js
 * expects). Equivalent to turning -90° around x.
 */
export function astronomyToScene({x, y, z}: Readonly<Vector3>) {
    return new Vector3(x, z, -y);
}

export function equatorialToEcliptic(vector: Readonly<Vector3>) {
    return vector.clone().applyAxisAngle(new Vector3(1, 0, 0), -obliquityRadians);
}

/**
 * A point on a body in its own frame: +y is the north pole, +x is latitude 0 and longitude 0, and
 * east (longitude +90°) is -z.
 */
export function latitudeLongitudeToDirection({
    latitudeDegrees,
    longitudeDegrees,
}: Readonly<{
    latitudeDegrees: number;
    longitudeDegrees: number;
}>) {
    const latitude = degreesToRadians(latitudeDegrees);
    const longitude = degreesToRadians(longitudeDegrees);
    return new Vector3(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        -Math.cos(latitude) * Math.sin(longitude),
    );
}

/** Undoes {@link latitudeLongitudeToDirection}. The vector does not need to be normalized. */
export function directionToLatitudeLongitude(direction: Readonly<Vector3>) {
    return {
        latitudeDegrees: radiansToDegrees(
            Math.asin(Math.max(-1, Math.min(1, direction.y / direction.length()))),
        ),
        longitudeDegrees: radiansToDegrees(Math.atan2(-direction.z, direction.x)),
    };
}

/**
 * Turns the body's own frame (see {@link latitudeLongitudeToDirection}) into the scene's frame,
 * built on the J2000 ecliptic.
 */
export function getBodyOrientation({
    rotation,
    daysSinceJ2000,
}: Readonly<{
    rotation: Readonly<BodyRotation>;
    daysSinceJ2000: number;
}>) {
    const rightAscension = degreesToRadians(rotation.poleRightAscensionDegrees);
    const declination = degreesToRadians(rotation.poleDeclinationDegrees);
    const pole = new Vector3(
        Math.cos(declination) * Math.cos(rightAscension),
        Math.cos(declination) * Math.sin(rightAscension),
        Math.sin(declination),
    );
    /** Where the body's equator crosses the equatorial frame's equator going north. */
    const ascendingNode = new Vector3(-Math.sin(rightAscension), Math.cos(rightAscension), 0);
    const primeMeridian = ascendingNode.applyAxisAngle(
        pole,
        degreesToRadians(
            rotation.primeMeridianAtJ2000Degrees +
                rotation.primeMeridianDegreesPerDay * daysSinceJ2000,
        ),
    );
    const west = primeMeridian.clone().cross(pole);

    function toScene(equatorial: Readonly<Vector3>) {
        return astronomyToScene(equatorialToEcliptic(equatorial));
    }

    return new Quaternion().setFromRotationMatrix(
        new Matrix4().makeBasis(toScene(primeMeridian), toScene(pole), toScene(west)),
    );
}
