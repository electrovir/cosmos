// cspell:words vizier
/** The 1-based inclusive byte columns of a field, as VizieR lists them. */
type ColumnRange = {
    firstColumn: number;
    lastColumn: number;
};

/** The J2000 position, V magnitude, and B−V color fields. */
const catalogColumns = {
    rightAscensionHours: {
        firstColumn: 76,
        lastColumn: 77,
    },
    rightAscensionMinutes: {
        firstColumn: 78,
        lastColumn: 79,
    },
    rightAscensionSeconds: {
        firstColumn: 80,
        lastColumn: 83,
    },
    declinationSign: {
        firstColumn: 84,
        lastColumn: 84,
    },
    declinationDegrees: {
        firstColumn: 85,
        lastColumn: 86,
    },
    declinationArcMinutes: {
        firstColumn: 87,
        lastColumn: 88,
    },
    declinationArcSeconds: {
        firstColumn: 89,
        lastColumn: 90,
    },
    visualMagnitude: {
        firstColumn: 103,
        lastColumn: 107,
    },
    colorIndex: {
        firstColumn: 110,
        lastColumn: 114,
    },
} satisfies Record<string, ColumnRange>;

function readField({
    line,
    firstColumn,
    lastColumn,
}: Readonly<
    {
        line: string;
    } & ColumnRange
>) {
    return line.slice(firstColumn - 1, lastColumn).trim();
}

/**
 * Reads the Yale Bright Star Catalog's `catalog` file (VizieR V/50). Entries with no position or no
 * magnitude, such as novae and objects later found not to be stars, are skipped. A missing B−V
 * color reads as 0.
 */
export function parseBrightStarCatalog(text: string) {
    return text.split('\n').flatMap((line) => {
        /** `NaN` for a blank field. */
        function readNumber({firstColumn, lastColumn}: Readonly<ColumnRange>) {
            const field = readField({
                line,
                firstColumn,
                lastColumn,
            });
            return field ? Number(field) : Number.NaN;
        }

        const declinationSign =
            readField({
                line,
                ...catalogColumns.declinationSign,
            }) === '-'
                ? -1
                : 1;
        const rightAscensionDegrees =
            15 *
            (readNumber(catalogColumns.rightAscensionHours) +
                readNumber(catalogColumns.rightAscensionMinutes) / 60 +
                readNumber(catalogColumns.rightAscensionSeconds) / 3600);
        const declinationDegrees =
            declinationSign *
            (readNumber(catalogColumns.declinationDegrees) +
                readNumber(catalogColumns.declinationArcMinutes) / 60 +
                readNumber(catalogColumns.declinationArcSeconds) / 3600);
        const visualMagnitude = readNumber(catalogColumns.visualMagnitude);
        const colorIndex = readNumber(catalogColumns.colorIndex);
        return [
            rightAscensionDegrees,
            declinationDegrees,
            visualMagnitude,
        ].every(Number.isFinite)
            ? [
                  {
                      rightAscensionDegrees,
                      declinationDegrees,
                      visualMagnitude,
                      colorIndex: Number.isNaN(colorIndex) ? 0 : colorIndex,
                  },
              ]
            : [];
    });
}
