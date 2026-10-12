export function degreesToRadians(degrees: number) {
    return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number) {
    return (radians * 180) / Math.PI;
}

/** Wraps into `[-180, 180)`. */
export function wrapLongitudeDegrees(degrees: number) {
    return ((((degrees + 180) % 360) + 360) % 360) - 180;
}
