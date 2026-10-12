// cspell:words ballesteros helland
import {createArray} from '@augment-vir/common';
import {Vector3} from 'three';
import {starValueOrder} from '../data/sky/sky-data-files.js';

/** Reads the bytes of `stars.bin`. Directions stay in the J2000 equatorial frame. */
export function parseStarCatalog(bytes: ArrayBuffer) {
    const values = new Float32Array(bytes);
    if (values.length % starValueOrder.length) {
        throw new Error(
            `Star data has ${values.length} values, which is not a whole number of stars. Run 'npm run build:data'.`,
        );
    }
    return createArray(values.length / starValueOrder.length, (index) => {
        const [
            x = 0,
            y = 0,
            z = 0,
            visualMagnitude = 0,
            colorIndex = 0,
        ] = values.subarray(index * starValueOrder.length, (index + 1) * starValueOrder.length);
        return {
            direction: new Vector3(x, y, z),
            visualMagnitude,
            colorIndex,
        };
    });
}

export type Star = ReturnType<typeof parseStarCatalog>[number];

/**
 * A star's color from its B−V index, with each channel from 0 to 1. The index gives a temperature
 * by Ballesteros (2012), and the temperature a blackbody color by Tanner Helland's curve fit.
 */
export function getStarColor(colorIndex: number) {
    const kelvin = 4600 * (1 / (0.92 * colorIndex + 1.7) + 1 / (0.92 * colorIndex + 0.62));
    const hundreds = kelvin / 100;
    function toChannel(value: number) {
        return Math.min(255, Math.max(0, value)) / 255;
    }
    return {
        r: toChannel(hundreds <= 66 ? 255 : 329.698727446 * (hundreds - 60) ** -0.1332047592),
        g: toChannel(
            hundreds <= 66
                ? 99.4708025861 * Math.log(hundreds) - 161.1195681661
                : 288.1221695283 * (hundreds - 60) ** -0.0755148492,
        ),
        b: toChannel(
            hundreds >= 66
                ? 255
                : hundreds <= 19
                  ? 0
                  : 138.5177312231 * Math.log(hundreds - 10) - 305.0447927307,
        ),
    };
}
