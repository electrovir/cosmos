// cspell:words ornstein uhlenbeck
/**
 * Random but plausible solar wind near Earth. Each quantity drifts around its typical value, and
 * now and then a coronal mass ejection (CME) arrives: a burst of fast, dense wind whose magnetic
 * field points south, which is what drives strong aurora.
 */

export type CoronalMassEjection = {
    elapsedSeconds: number;
    durationSeconds: number;
    speedKmPerSecond: number;
    densityFactor: number;
    southwardFieldNanotesla: number;
};

export type SolarWindState = {
    logDensity: number;
    speedKmPerSecond: number;
    /** The north-south part of the wind's magnetic field. Negative is south. */
    fieldZNanotesla: number;
    activity: number;
    coronalMassEjection: Readonly<CoronalMassEjection> | undefined;
};

export type SolarWindConditions = {
    /** Protons per cubic centimeter. */
    density: number;
    speedKmPerSecond: number;
    fieldZNanotesla: number;
    dynamicPressureNanopascals: number;
    /** How strongly the wind is stirring up the magnetosphere, from 0 to 1. */
    activity: number;
    isCoronalMassEjection: boolean;
};

/** A seeded random number generator (mulberry32) returning values in `[0, 1)`. */
export function createRandom(seed: number) {
    const state = {
        value: seed >>> 0,
    };
    return () => {
        state.value = (state.value + 0x6d_2b_79_f5) >>> 0;
        const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
        const remixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((remixed ^ (remixed >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function randomNormal(random: () => number) {
    return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

/**
 * Steps an Ornstein-Uhlenbeck process: a random walk that is pulled back toward its mean, so it
 * wanders by about `deviation` and changes over about `timeScaleSeconds`. Exact for any step size.
 */
function stepDrift({
    value,
    mean,
    deviation,
    timeScaleSeconds,
    elapsedSeconds,
    random,
}: Readonly<{
    value: number;
    mean: number;
    deviation: number;
    timeScaleSeconds: number;
    elapsedSeconds: number;
    random: () => number;
}>) {
    const decay = Math.exp(-elapsedSeconds / timeScaleSeconds);
    return (
        mean +
        (value - mean) * decay +
        deviation * Math.sqrt(1 - decay * decay) * randomNormal(random)
    );
}

export const quietSolarWind: Readonly<SolarWindState> = {
    logDensity: Math.log(5),
    speedKmPerSecond: 400,
    fieldZNanotesla: 0,
    activity: 0,
    coronalMassEjection: undefined,
};

const averageSecondsBetweenEjections = 90;

function stepCoronalMassEjection({
    coronalMassEjection,
    elapsedSeconds,
    random,
}: Readonly<{
    coronalMassEjection: Readonly<CoronalMassEjection> | undefined;
    elapsedSeconds: number;
    random: () => number;
}>) {
    if (coronalMassEjection) {
        const nextElapsedSeconds = coronalMassEjection.elapsedSeconds + elapsedSeconds;
        return nextElapsedSeconds < coronalMassEjection.durationSeconds
            ? {
                  ...coronalMassEjection,
                  elapsedSeconds: nextElapsedSeconds,
              }
            : undefined;
    } else if (random() < 1 - Math.exp(-elapsedSeconds / averageSecondsBetweenEjections)) {
        return {
            elapsedSeconds: 0,
            durationSeconds: 20 + random() * 10,
            speedKmPerSecond: 700 + random() * 200,
            densityFactor: 3 + random() * 2,
            southwardFieldNanotesla: 10 + random() * 10,
        };
    } else {
        return undefined;
    }
}

/** How much of the CME is felt: it hits quickly, then fades out. */
function getEjectionStrength(coronalMassEjection: Readonly<CoronalMassEjection> | undefined) {
    return coronalMassEjection
        ? Math.min(
              1,
              coronalMassEjection.elapsedSeconds / 2,
              (coronalMassEjection.durationSeconds - coronalMassEjection.elapsedSeconds) / 8,
          )
        : 0;
}

export function getSolarWindConditions({
    logDensity,
    speedKmPerSecond,
    fieldZNanotesla,
    activity,
    coronalMassEjection,
}: Readonly<SolarWindState>) {
    const strength = getEjectionStrength(coronalMassEjection);
    const density =
        Math.exp(logDensity) * (1 + strength * ((coronalMassEjection?.densityFactor ?? 1) - 1));
    const speed =
        speedKmPerSecond +
        strength * ((coronalMassEjection?.speedKmPerSecond ?? speedKmPerSecond) - speedKmPerSecond);
    return {
        density,
        speedKmPerSecond: speed,
        fieldZNanotesla:
            fieldZNanotesla - strength * (coronalMassEjection?.southwardFieldNanotesla ?? 0),
        /** Ram pressure `ρv²` with the mass of a proton, converted to nanopascals. */
        dynamicPressureNanopascals: 1.6726e-6 * density * speed * speed,
        activity,
        isCoronalMassEjection: !!coronalMassEjection,
    };
}

/**
 * How hard the wind drives the magnetosphere. Southward field reconnects with Earth's field and
 * lets the wind's energy in, roughly in proportion to speed times southward field strength.
 */
function getActivityTarget({
    speedKmPerSecond,
    fieldZNanotesla,
}: Readonly<Pick<SolarWindConditions, 'speedKmPerSecond' | 'fieldZNanotesla'>>) {
    return (
        0.15 + 0.85 * Math.min(1, (speedKmPerSecond * Math.max(0, -fieldZNanotesla)) / (800 * 15))
    );
}

export function advanceSolarWind({
    state,
    elapsedSeconds,
    random,
}: Readonly<{
    state: Readonly<SolarWindState>;
    elapsedSeconds: number;
    random: () => number;
}>) {
    const coronalMassEjection = stepCoronalMassEjection({
        coronalMassEjection: state.coronalMassEjection,
        elapsedSeconds,
        random,
    });
    const nextState: SolarWindState = {
        logDensity: stepDrift({
            value: state.logDensity,
            mean: quietSolarWind.logDensity,
            deviation: 0.4,
            timeScaleSeconds: 30,
            elapsedSeconds,
            random,
        }),
        speedKmPerSecond: Math.max(
            250,
            stepDrift({
                value: state.speedKmPerSecond,
                mean: quietSolarWind.speedKmPerSecond,
                deviation: 60,
                timeScaleSeconds: 40,
                elapsedSeconds,
                random,
            }),
        ),
        fieldZNanotesla: stepDrift({
            value: state.fieldZNanotesla,
            mean: 0,
            deviation: 3,
            timeScaleSeconds: 20,
            elapsedSeconds,
            random,
        }),
        activity: state.activity,
        coronalMassEjection,
    };
    const activityBlend = 1 - Math.exp(-elapsedSeconds / 5);
    return {
        ...nextState,
        activity:
            state.activity +
            (getActivityTarget(getSolarWindConditions(nextState)) - state.activity) * activityBlend,
    };
}

/**
 * Eases `previous` toward `next` with an exponential moving average, so the per-step noise of the
 * random drift doesn't show as flicker. CME status switches immediately.
 */
export function smoothSolarWindConditions({
    previous,
    next,
    elapsedSeconds,
    timeScaleSeconds,
}: Readonly<{
    previous: Readonly<SolarWindConditions>;
    next: Readonly<SolarWindConditions>;
    elapsedSeconds: number;
    timeScaleSeconds: number;
}>) {
    const blend = 1 - Math.exp(-elapsedSeconds / timeScaleSeconds);

    function ease(key: Exclude<keyof SolarWindConditions, 'isCoronalMassEjection'>) {
        return previous[key] + (next[key] - previous[key]) * blend;
    }

    return {
        density: ease('density'),
        speedKmPerSecond: ease('speedKmPerSecond'),
        fieldZNanotesla: ease('fieldZNanotesla'),
        dynamicPressureNanopascals: ease('dynamicPressureNanopascals'),
        activity: ease('activity'),
        isCoronalMassEjection: next.isCoronalMassEjection,
    };
}
