const blockSize = 512;

/** Reads a tar header text field, which ends at its first null byte or at the field's end. */
function readHeaderText(field: Readonly<Buffer>) {
    const nullIndex = field.indexOf(0);
    return field.subarray(0, nullIndex < 0 ? field.length : nullIndex).toString('utf8');
}

/**
 * Pulls one file's contents out of an uncompressed tar archive by its exact path within the
 * archive. Returns `undefined` when the archive has no such file.
 */
export function extractTarFile({
    tarBytes,
    filePath,
}: Readonly<{
    tarBytes: Readonly<Uint8Array>;
    filePath: string;
}>): Uint8Array | undefined {
    /** Recursion is why the return type is annotated. */
    function findFrom(headerOffset: number): Uint8Array | undefined {
        const header = Buffer.from(tarBytes.subarray(headerOffset, headerOffset + blockSize));
        /** An all-zero header (or running out of bytes) marks the end of the archive. */
        if (header.length < blockSize || header.every((byte) => !byte)) {
            return undefined;
        }
        const name = readHeaderText(header.subarray(0, 100));
        const prefix = readHeaderText(header.subarray(345, 500));
        const size = Number.parseInt(readHeaderText(header.subarray(124, 136)).trim(), 8);
        const dataOffset = headerOffset + blockSize;
        if ((prefix ? `${prefix}/${name}` : name) === filePath) {
            return tarBytes.slice(dataOffset, dataOffset + size);
        }
        return findFrom(dataOffset + Math.ceil(size / blockSize) * blockSize);
    }

    return findFrom(0);
}
