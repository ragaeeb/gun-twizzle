import { describe, expect, it } from 'vitest';

import { createClock, getAlpha, tickClock } from '../clock';

describe('SimClock', () => {
    it('creates a clock with correct defaults', () => {
        const clock = createClock();
        expect(clock.dt).toBeCloseTo(1 / 60);
        expect(clock.accumulator).toBe(0);
        expect(clock.simTime).toBe(0);
    });

    it('creates a clock with custom hz', () => {
        const clock = createClock(30);
        expect(clock.dt).toBeCloseTo(1 / 30);
    });

    it('rejects invalid hz values', () => {
        expect(() => createClock(0)).toThrow(RangeError);
        expect(() => createClock(-1)).toThrow(RangeError);
        expect(() => createClock(Number.NaN)).toThrow(RangeError);
    });

    it('returns 1 step for exactly one dt', () => {
        const clock = createClock(60);
        const steps = tickClock(clock, clock.dt);
        expect(steps).toBe(1);
        expect(clock.simTime).toBeCloseTo(clock.dt);
    });

    it('returns 0 steps for less than one dt', () => {
        const clock = createClock(60);
        const steps = tickClock(clock, clock.dt * 0.5);
        expect(steps).toBe(0);
        expect(clock.accumulator).toBeCloseTo(clock.dt * 0.5);
    });

    it('accumulates across multiple calls', () => {
        const clock = createClock(60);
        tickClock(clock, clock.dt * 0.6);
        const steps = tickClock(clock, clock.dt * 0.6);
        expect(steps).toBe(1);
    });

    it('returns multiple steps for large deltas', () => {
        const clock = createClock(60);
        const steps = tickClock(clock, clock.dt * 3.5);
        expect(steps).toBe(3);
    });

    it('caps at 5 steps to prevent spiral of death', () => {
        const clock = createClock(60);
        const steps = tickClock(clock, 1.0); // 1 full second = 60 steps normally
        expect(steps).toBe(5);
    });

    it('preserves pre-existing remainder when delta is capped', () => {
        const clock = createClock(60);
        const preloadSteps = tickClock(clock, clock.dt * 0.75);
        expect(preloadSteps).toBe(0);
        const steps = tickClock(clock, 1.0);
        expect(steps).toBe(5);
        expect(clock.accumulator).toBeCloseTo(clock.dt * 0.75, 10);
    });

    it('simTime advances correctly over multiple ticks', () => {
        const clock = createClock(60);
        tickClock(clock, clock.dt * 2);
        tickClock(clock, clock.dt * 3);
        expect(clock.simTime).toBeCloseTo(clock.dt * 5);
    });

    it('getAlpha returns value between 0 and 1', () => {
        const clock = createClock(60);
        tickClock(clock, clock.dt * 1.5);
        const alpha = getAlpha(clock);
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThan(1);
    });

    it('getAlpha returns 0 when no remainder', () => {
        const clock = createClock(60);
        tickClock(clock, clock.dt);
        const alpha = getAlpha(clock);
        expect(alpha).toBeCloseTo(0, 5);
    });

    it('rejects invalid frame deltas', () => {
        const clock = createClock(60);
        expect(() => tickClock(clock, -0.1)).toThrow(RangeError);
        expect(() => tickClock(clock, Number.NaN)).toThrow(RangeError);
    });

    it('rejects mutated clock dt', () => {
        const clock = createClock(60);
        clock.dt = 0;
        expect(() => tickClock(clock, 0.016)).toThrow(RangeError);
    });
});
