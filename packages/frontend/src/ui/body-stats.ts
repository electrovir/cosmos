import {Vector3} from 'three';
import {bodyCatalog, earthMassKg, kilometersPerAstronomicalUnit} from '../data/body-catalog.js';
import {BodyId, type BodyDetails, type BodySummary} from '../data/celestial-body.js';
import {degreesToRadians, radiansToDegrees} from '../physics/angles.js';
import {equatorialToEcliptic} from '../physics/frames.js';
import {
    moonAxialTiltDegrees,
    moonEccentricity,
    moonSemiMajorAxisKm,
    moonSiderealPeriodDays,
} from '../physics/moon-position.js';

const gravitationalConstant = 6.6743e-11;
const standardGravity = 9.80665;
const superscriptDigits = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * Rounds to a few significant digits, with digit grouping. Values too small to read that way are
 * written as `2.5 × 10⁻⁴`.
 */
export function formatNumber(value: number, maximumSignificantDigits = 3) {
    if (!value || Math.abs(value) >= 0.001) {
        return value.toLocaleString('en-US', {
            maximumSignificantDigits,
        });
    }
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const exponentText = [
        exponent < 0 ? '⁻' : '',
        ...String(Math.abs(exponent))
            .split('')
            .map((digit) => superscriptDigits[Number(digit)]),
    ].join('');
    return `${(value / 10 ** exponent).toLocaleString('en-US', {
        maximumSignificantDigits: 2,
    })} × 10${exponentText}`;
}

/** Hours and minutes under two days, days under two years, and years beyond that. */
export function formatPeriod(days: number) {
    if (days < 2) {
        const totalMinutes = Math.round(days * 24 * 60);
        return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} m`;
    }
    return days < 730 ? `${formatNumber(days)} days` : `${formatNumber(days / 365.25)} years`;
}

/**
 * The angle between the way the body spins (by the right-hand rule) and its orbit's axis, or the
 * ecliptic's axis for a body without an orbit, in degrees. Over 90° means it spins backward.
 */
export function getAxialTiltDegrees(summary: Readonly<Pick<BodySummary, 'orbit' | 'rotation'>>) {
    if (!summary.rotation) {
        return undefined;
    }
    const rightAscension = degreesToRadians(summary.rotation.poleRightAscensionDegrees);
    const declination = degreesToRadians(summary.rotation.poleDeclinationDegrees);
    /**
     * The IAU gives Venus and Uranus the pole on the north side of the solar system, with a
     * negative spin rate, so the spin's own axis is the opposite pole.
     */
    const spinAxis = equatorialToEcliptic(
        new Vector3(
            Math.cos(declination) * Math.cos(rightAscension),
            Math.cos(declination) * Math.sin(rightAscension),
            Math.sin(declination),
        ),
    ).multiplyScalar(Math.sign(summary.rotation.primeMeridianDegreesPerDay));
    const inclination = degreesToRadians(summary.orbit?.inclinationDegrees ?? 0);
    const ascendingNode = degreesToRadians(summary.orbit?.longitudeOfAscendingNodeDegrees ?? 0);
    const orbitAxis = new Vector3(
        Math.sin(inclination) * Math.sin(ascendingNode),
        -Math.sin(inclination) * Math.cos(ascendingNode),
        Math.cos(inclination),
    );
    return radiansToDegrees(spinAxis.angleTo(orbitAxis));
}

/** The facts shown in a body's info panel, in order. Values that don't apply are `–`. */
export function getBodyStats({
    summary,
    details,
}: Readonly<{
    summary: Readonly<BodySummary>;
    details: Readonly<BodyDetails>;
}>) {
    const radiusMeters = summary.radiusKm * 1000;
    const gravitationalParameter = gravitationalConstant * details.massKg;
    const isMoon = summary.id === BodyId.Moon;
    const axialTiltDegrees = isMoon ? moonAxialTiltDegrees : getAxialTiltDegrees(summary);
    /** The Moon's orbit is computed by its own formula instead of from orbit elements. */
    const orbitPeriodDays =
        summary.orbit?.periodDays ?? (isMoon ? moonSiderealPeriodDays : undefined);
    const semiMajorAxisKm =
        summary.orbit?.semiMajorAxisKm ?? (isMoon ? moonSemiMajorAxisKm : undefined);
    const eccentricity = summary.orbit?.eccentricity ?? (isMoon ? moonEccentricity : undefined);
    const escapeMetersPerSecond = Math.sqrt((2 * gravitationalParameter) / radiusMeters);
    const massInEarths = details.massKg / earthMassKg;

    return [
        {
            label: 'Discovered',
            value: details.discovery ? String(details.discovery.year) : 'Prehistoric',
        },
        {
            label: 'Discovered by',
            value: details.discovery?.discoverer || '–',
        },
        {
            label: 'Diameter',
            value: `${Math.round(summary.radiusKm * 2).toLocaleString('en-US')} km`,
        },
        {
            label: 'Mass',
            value: `${formatNumber(massInEarths)} ${massInEarths === 1 ? 'Earth' : 'Earths'}`,
        },
        {
            label: 'Density',
            value: `${formatNumber(
                details.massKg / ((4 / 3) * Math.PI * radiusMeters ** 3) / 1000,
            )} g/cm³`,
        },
        {
            label: 'Surface gravity',
            value: `${formatNumber(gravitationalParameter / radiusMeters ** 2 / standardGravity)} g`,
        },
        {
            label: 'Escape velocity',
            value:
                escapeMetersPerSecond < 1000
                    ? `${formatNumber(escapeMetersPerSecond)} m/s`
                    : `${formatNumber(escapeMetersPerSecond / 1000)} km/s`,
        },
        {
            label: 'Day length',
            value: summary.rotation
                ? [
                      formatPeriod(360 / Math.abs(summary.rotation.primeMeridianDegreesPerDay)),
                      axialTiltDegrees != undefined && axialTiltDegrees > 90 ? ' (backward)' : '',
                  ].join('')
                : '–',
        },
        {
            label: 'Axial tilt',
            value:
                axialTiltDegrees == undefined
                    ? '–'
                    : `${axialTiltDegrees.toLocaleString('en-US', {
                          maximumFractionDigits: 1,
                      })}°`,
        },
        {
            label: 'Orbital period',
            value: orbitPeriodDays == undefined ? '–' : formatPeriod(orbitPeriodDays),
        },
        {
            label: 'Mean distance',
            value:
                semiMajorAxisKm == undefined || !summary.parentId
                    ? '–'
                    : summary.parentId === BodyId.Sun
                      ? `${formatNumber(semiMajorAxisKm / kilometersPerAstronomicalUnit)} AU from the Sun`
                      : `${formatNumber(semiMajorAxisKm)} km from ${bodyCatalog[summary.parentId].name}`,
        },
        {
            label: 'Orbital eccentricity',
            value:
                eccentricity == undefined
                    ? '–'
                    : eccentricity.toLocaleString('en-US', {
                          maximumFractionDigits: 3,
                      }),
        },
        {
            label: 'Atmosphere',
            value:
                details.atmosphereGases
                    ?.map((gas) => {
                        return `${gas.gas} ${formatNumber(gas.percent)}%`;
                    })
                    .join(', ') || '–',
        },
        {
            label: 'Surface pressure',
            value:
                details.surfacePressureBar == undefined
                    ? '–'
                    : `${formatNumber(details.surfacePressureBar)} bar`,
        },
        {
            label: 'Mean temperature',
            value: `${Math.round(details.meanTemperatureKelvin - 273.15).toLocaleString('en-US')} °C`,
        },
        ...(summary.knownMoonCount == undefined
            ? []
            : [
                  {
                      label: 'Known moons',
                      value: String(summary.knownMoonCount),
                  },
              ]),
    ];
}
