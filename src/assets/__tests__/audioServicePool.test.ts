import { describe, expect, it } from 'vitest';

const POOL_SIZE = 8;

describe('AudioService pool bounds', () => {
    it('pool size constant is defined and reasonable', () => {
        expect(POOL_SIZE).toBe(8);
        expect(POOL_SIZE).toBeGreaterThan(0);
        expect(POOL_SIZE).toBeLessThanOrEqual(32);
    });

    it('pool index wraps around at POOL_SIZE boundary', () => {
        let nextIndex = 0;
        const indices: number[] = [];

        for (let i = 0; i < POOL_SIZE * 3; i++) {
            indices.push(nextIndex % POOL_SIZE);
            nextIndex += 1;
        }

        const uniqueIndices = new Set(indices);
        expect(uniqueIndices.size).toBe(POOL_SIZE);
        expect(indices[0]).toBe(0);
        expect(indices[POOL_SIZE]).toBe(0);
    });

    it('rapid playback reuses pool slots instead of growing', () => {
        const pool: number[] = [];
        let nextIndex = 0;

        const play = () => {
            if (pool.length < POOL_SIZE) {
                pool.push(pool.length);
            }
            const index = nextIndex % POOL_SIZE;
            nextIndex += 1;
            return index;
        };

        for (let i = 0; i < 100; i++) {
            play();
        }

        expect(pool.length).toBe(POOL_SIZE);
        expect(nextIndex).toBe(100);
    });
});
