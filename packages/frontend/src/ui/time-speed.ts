import {assertWrap} from '@augment-vir/assert';
import {convertDuration, formatDuration} from 'date-vir';

/**
 * Shown seconds per real second at evenly spaced slider positions, from real time at the far left
 * to the fastest at the far right.
 */
const timeSpeedStops = [
    {
        seconds: 1,
    },
    {
        hours: 1,
    },
    {
        days: 1,
    },
    {
        weeks: 1,
    },
    {
        months: 1,
    },
].map((duration) => {
    return convertDuration(duration, {
        seconds: true,
    }).seconds;
});

/**
 * The fastest a body is shown spinning, in shown seconds per real second. Faster spins strobe
 * instead of looking like motion.
 */
const maxSpinSpeed = convertDuration(
    {
        hours: 6,
    },
    {
        seconds: true,
    },
).seconds;

/**
 * How many times faster than real time the shown time runs, from a slider position from 0 (real
 * time) to 1. Between stops the speed grows by the same factor for each step of the slider.
 */
export function getTimeSpeed(sliderPosition: number) {
    const scaled = Math.min(Math.max(sliderPosition, 0), 1) * (timeSpeedStops.length - 1);
    const index = Math.min(Math.floor(scaled), timeSpeedStops.length - 2);
    const lower = assertWrap.isDefined(timeSpeedStops[index]);
    const upper = assertWrap.isDefined(timeSpeedStops[index + 1]);
    return lower * (upper / lower) ** (scaled - index);
}

/** How much shown time passes each real second, rounded down to its largest unit. */
export function formatTimeSpeed(speed: number) {
    return speed < 1.5
        ? 'Real time'
        : `${formatDuration(
              convertDuration(
                  {
                      seconds: Math.round(speed),
                  },
                  {
                      months: true,
                      weeks: true,
                      days: true,
                      hours: true,
                      minutes: true,
                      seconds: true,
                  },
              ),
              {
                  onlyLargestUnit: true,
              },
          )} per second`;
}

/**
 * How far a body's spin runs behind the shown time after one more frame. The spin runs behind
 * whenever time runs faster than the body is allowed to spin, then catches back up at top spin
 * speed once time slows down. Whole turns of lag don't change how the body looks, so the lag is
 * kept under one turn.
 */
export function advanceSpinLag({
    spinLagMilliseconds,
    frameSeconds,
    speed,
    spinPeriodMilliseconds,
}: Readonly<{
    spinLagMilliseconds: number;
    frameSeconds: number;
    speed: number;
    /** One full turn of the body against the stars. */
    spinPeriodMilliseconds: number;
}>) {
    const shownAdvance = frameSeconds * 1000 * speed;
    const spinAdvance = Math.min(
        shownAdvance + spinLagMilliseconds,
        frameSeconds * 1000 * maxSpinSpeed,
    );
    return (spinLagMilliseconds + shownAdvance - spinAdvance) % spinPeriodMilliseconds;
}
