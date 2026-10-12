// cspell:words opendap dods
const dataMarker = '\nData:\n';

/**
 * Reads the first array out of an OPeNDAP (DAP2) `.dods` response, which must be a `Float32` array.
 * The response is a text description of the data followed by `Data:` and then the arrays in XDR
 * encoding: each array starts with its length written twice as big-endian `Uint32` values, followed
 * by big-endian values.
 */
export function parseDap2Float32Array(response: Readonly<Uint8Array>) {
    const markerIndex = Buffer.from(response).indexOf(dataMarker);
    if (markerIndex < 0) {
        throw new Error(
            `OPeNDAP response has no '${dataMarker.trim()}' section: ${Buffer.from(response.subarray(0, 200)).toString()}`,
        );
    }
    const view = new DataView(
        response.buffer,
        response.byteOffset + markerIndex + dataMarker.length,
    );
    const count = view.getUint32(0);
    const repeatedCount = view.getUint32(4);
    if (count !== repeatedCount) {
        throw new Error(`OPeNDAP array lengths disagree: ${count} and ${repeatedCount}.`);
    }
    const valuesStart = 8;
    if (view.byteLength < valuesStart + count * 4) {
        throw new Error(
            `OPeNDAP response is truncated: expected ${count} values but only ${Math.floor((view.byteLength - valuesStart) / 4)} fit.`,
        );
    }
    const values = new Float32Array(count);
    values.forEach((value, index) => {
        values[index] = view.getFloat32(valuesStart + index * 4);
    });
    return values;
}
