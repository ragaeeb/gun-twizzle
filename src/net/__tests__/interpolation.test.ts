import { describe, expect, it } from 'vitest';
import {
    createInterpolationBuffer,
    lerpTransform,
    lerpVec3,
    slerpQuat,
    type TransformSnapshot,
} from '../interpolation';
import type { QuatTuple } from '../protocol';

describe('lerpVec3', () => {
    it('returns a at t=0', () => {
        const result = lerpVec3([1, 2, 3], [4, 5, 6], 0);
        expect(result).toEqual([1, 2, 3]);
    });

    it('returns b at t=1', () => {
        const result = lerpVec3([1, 2, 3], [4, 5, 6], 1);
        expect(result).toEqual([4, 5, 6]);
    });

    it('returns midpoint at t=0.5', () => {
        const result = lerpVec3([0, 0, 0], [10, 20, 30], 0.5);
        expect(result).toEqual([5, 10, 15]);
    });
});

describe('slerpQuat', () => {
    it('returns a at t=0', () => {
        const a: QuatTuple = [1, 0, 0, 0];
        const b: QuatTuple = [Math.SQRT1_2, 0, Math.SQRT1_2, 0];
        const result = slerpQuat(a, b, 0);
        expect(result[0]).toBeCloseTo(1, 3);
        expect(result[1]).toBeCloseTo(0, 3);
        expect(result[2]).toBeCloseTo(0, 3);
        expect(result[3]).toBeCloseTo(0, 3);
    });

    it('returns b at t=1', () => {
        const a: QuatTuple = [1, 0, 0, 0];
        const b: QuatTuple = [Math.SQRT1_2, 0, Math.SQRT1_2, 0];
        const result = slerpQuat(a, b, 1);
        expect(result[0]).toBeCloseTo(Math.SQRT1_2, 2);
        expect(result[2]).toBeCloseTo(Math.SQRT1_2, 2);
    });

    it('handles identity quaternion', () => {
        const id: QuatTuple = [1, 0, 0, 0];
        const result = slerpQuat(id, id, 0.5);
        expect(result[0]).toBeCloseTo(1, 5);
    });
});

describe('InterpolationBuffer', () => {
    const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;

    it('returns null for empty buffer', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        expect(buf.interpolate(1000)).toBeNull();
    });

    it('returns the single entry if only one exists', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        buf.push(1, 100, 42);
        expect(buf.interpolate(150)).toBe(42);
    });

    it('interpolates between two snapshots', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        buf.push(1, 100, 0);
        buf.push(2, 200, 100);

        expect(buf.interpolate(150)).toBe(50);
    });

    it('respects render delay', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 100);
        buf.push(1, 100, 0);
        buf.push(2, 200, 100);

        // At renderTime=300, targetTime=200, which is the end snapshot
        expect(buf.interpolate(300)).toBe(100);
    });

    it('returns latest entry when target time is past all snapshots', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        buf.push(1, 100, 10);
        buf.push(2, 200, 20);

        expect(buf.interpolate(500)).toBe(20);
    });

    it('returns the oldest entry when target time is before all snapshots', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        buf.push(1, 100, 10);
        buf.push(2, 200, 20);

        expect(buf.interpolate(50)).toBe(10);
    });

    it('evicts old entries when buffer is full', () => {
        const buf = createInterpolationBuffer(lerpNum, 2, 0);
        buf.push(1, 100, 10);
        buf.push(2, 200, 20);
        buf.push(3, 300, 30);

        // Entry for tick 1 should be evicted
        expect(buf.interpolate(250)).toBe(25);
    });

    it('clears all entries', () => {
        const buf = createInterpolationBuffer(lerpNum, 4, 0);
        buf.push(1, 100, 10);
        buf.clear();
        expect(buf.interpolate(100)).toBeNull();
    });
});

describe('lerpTransform', () => {
    it('interpolates position and rotation', () => {
        const a: TransformSnapshot = {
            position: [0, 0, 0],
            rotation: [1, 0, 0, 0],
        };
        const b: TransformSnapshot = {
            position: [10, 20, 30],
            rotation: [1, 0, 0, 0],
        };

        const result = lerpTransform(a, b, 0.5);
        expect(result.position).toEqual([5, 10, 15]);
    });
});
