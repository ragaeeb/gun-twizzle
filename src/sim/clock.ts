export type SimClock = {
    accumulator: number;
    dt: number;
    simTime: number;
};

export const createClock = (hz = 60): SimClock => {
    if (!Number.isFinite(hz) || hz <= 0) {
        throw new RangeError('hz must be a finite number > 0');
    }

    return {
        accumulator: 0,
        dt: 1 / hz,
        simTime: 0,
    };
};

/**
 * Advance the clock by `frameDelta` seconds.
 * Returns the number of fixed steps to execute.
 * Caps at 5 steps to prevent spiral-of-death on frame hitches.
 */
export const tickClock = (clock: SimClock, frameDelta: number): number => {
    if (!Number.isFinite(clock.dt) || clock.dt <= 0) {
        throw new RangeError('clock.dt must be a finite number > 0');
    }
    if (!Number.isFinite(frameDelta) || frameDelta < 0) {
        throw new RangeError('frameDelta must be a finite number >= 0');
    }

    const maxSteps = 5;
    const cappedDelta = Math.min(frameDelta, clock.dt * maxSteps);
    clock.accumulator += cappedDelta;

    let steps = 0;

    while (clock.accumulator >= clock.dt) {
        clock.accumulator -= clock.dt;
        clock.simTime += clock.dt;
        steps += 1;
    }

    return steps;
};

/**
 * Returns the interpolation alpha for rendering between two sim states.
 * Value in [0, 1) — useful for smooth visual interpolation.
 */
export const getAlpha = (clock: SimClock): number => {
    return clock.accumulator / clock.dt;
};
