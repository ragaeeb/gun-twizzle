/**
 * Entity interpolation — buffers server snapshots and lerps between them
 * so remote entities (other players, enemies) render smoothly rather than
 * teleporting between discrete server positions.
 */

import type { QuatTuple, Vec3Tuple } from './protocol';

export type SnapshotEntry<T> = {
    data: T;
    tick: number;
    time: number;
};

const DEFAULT_BUFFER_SIZE = 4;
const DEFAULT_RENDER_DELAY_MS = 100;

export type InterpolationBuffer<T> = {
    /** Remove all buffered snapshots. */
    clear: () => void;
    /** Compute the interpolated value at the given render time. */
    interpolate: (renderTime: number) => T | null;
    /** Push a new snapshot. */
    push: (tick: number, time: number, data: T) => void;
};

export const createInterpolationBuffer = <T>(
    lerpFn: (a: T, b: T, t: number) => T,
    bufferSize = DEFAULT_BUFFER_SIZE,
    renderDelayMs = DEFAULT_RENDER_DELAY_MS,
): InterpolationBuffer<T> => {
    let entries: Array<SnapshotEntry<T>> = [];

    return {
        clear: () => {
            entries = [];
        },

        interpolate: (renderTime: number) => {
            const targetTime = renderTime - renderDelayMs;

            if (entries.length === 0) {
                return null;
            }

            if (entries.length === 1) {
                return entries[0]!.data;
            }

            // Find the two snapshots that bracket targetTime
            let before: SnapshotEntry<T> | null = null;
            let after: SnapshotEntry<T> | null = null;

            for (let i = 0; i < entries.length - 1; i++) {
                const current = entries[i]!;
                const next = entries[i + 1]!;
                if (current.time <= targetTime && next.time >= targetTime) {
                    before = current;
                    after = next;
                    break;
                }
            }

            // If target time is past all snapshots, use the latest
            if (!before || !after) {
                return entries[entries.length - 1]!.data;
            }

            const range = after.time - before.time;
            const t = range > 0 ? (targetTime - before.time) / range : 1;
            return lerpFn(before.data, after.data, Math.max(0, Math.min(1, t)));
        },

        push: (tick: number, time: number, data: T) => {
            entries.push({ data, tick, time });
            while (entries.length > bufferSize) {
                entries.shift();
            }
        },
    };
};

// ─── Built-in lerp helpers ──────────────────────────────────────────────

export const lerpVec3 = (a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

/**
 * Spherical linear interpolation for quaternions.
 * Input/output: [w, x, y, z].
 */
export const slerpQuat = (a: QuatTuple, b: QuatTuple, t: number): QuatTuple => {
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

    const bSign: QuatTuple = dot < 0 ? [-b[0], -b[1], -b[2], -b[3]] : [...b];
    dot = Math.abs(dot);

    // Fall back to linear interpolation for nearly-parallel quats
    if (dot > 0.9995) {
        return normalizeQuat([
            a[0] + (bSign[0] - a[0]) * t,
            a[1] + (bSign[1] - a[1]) * t,
            a[2] + (bSign[2] - a[2]) * t,
            a[3] + (bSign[3] - a[3]) * t,
        ]);
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;

    return [a[0] * wa + bSign[0] * wb, a[1] * wa + bSign[1] * wb, a[2] * wa + bSign[2] * wb, a[3] * wa + bSign[3] * wb];
};

const normalizeQuat = (q: QuatTuple): QuatTuple => {
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    if (len < 1e-10) {
        return [1, 0, 0, 0];
    }
    return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
};

// ─── Composite transform interpolation ─────────────────────────────────

export type TransformSnapshot = {
    position: Vec3Tuple;
    rotation: QuatTuple;
};

export const lerpTransform = (a: TransformSnapshot, b: TransformSnapshot, t: number): TransformSnapshot => ({
    position: lerpVec3(a.position, b.position, t),
    rotation: slerpQuat(a.rotation, b.rotation, t),
});
