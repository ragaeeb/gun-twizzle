import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../events';
import { createEventQueue, pushEvent, swapEventBuffers } from '../events';

describe('EventQueue', () => {
    it('starts with empty buffers', () => {
        const q = createEventQueue();
        expect(q.write).toHaveLength(0);
        expect(q.read).toHaveLength(0);
    });

    it('pushEvent adds to write buffer only', () => {
        const q = createEventQueue();
        const event: SimEvent = {
            position: null,
            soundId: 'test',
            type: 'playSound',
        };
        pushEvent(q, event);
        expect(q.write).toHaveLength(1);
        expect(q.read).toHaveLength(0);
    });

    it('swap moves write to read and clears write', () => {
        const q = createEventQueue();
        pushEvent(q, { position: null, soundId: 'a', type: 'playSound' });
        pushEvent(q, { position: null, soundId: 'b', type: 'playSound' });
        swapEventBuffers(q);
        expect(q.read).toHaveLength(2);
        expect(q.write).toHaveLength(0);
    });

    it('swap reuses old read buffer as new write (no allocation)', () => {
        const q = createEventQueue();
        const originalWrite = q.write;
        const originalRead = q.read;
        pushEvent(q, { position: null, soundId: 'x', type: 'playSound' });
        swapEventBuffers(q);
        expect(q.read).toBe(originalWrite);
        expect(q.write).toBe(originalRead);
    });

    it('consecutive swaps work correctly', () => {
        const q = createEventQueue();
        pushEvent(q, { position: null, soundId: 'a', type: 'playSound' });
        swapEventBuffers(q);
        pushEvent(q, { position: null, soundId: 'b', type: 'playSound' });
        swapEventBuffers(q);
        expect(q.read).toHaveLength(1);
        expect(q.read[0]).toHaveProperty('soundId', 'b');
    });

    it('preserves event data through swap', () => {
        const q = createEventQueue();
        const event: SimEvent = {
            amount: 25,
            hitNormal: { x: 0, y: 1, z: 0 },
            hitPoint: { x: 1, y: 2, z: 3 },
            isHeadshot: true,
            targetId: 42,
            type: 'damage',
        };
        pushEvent(q, event);
        swapEventBuffers(q);
        expect(q.read[0]).toEqual(event);
    });

    it('handles multiple event types in one tick', () => {
        const q = createEventQueue();
        pushEvent(q, {
            amount: 10,
            hitNormal: { x: 0, y: 1, z: 0 },
            hitPoint: { x: 0, y: 0, z: 0 },
            isHeadshot: false,
            targetId: 1,
            type: 'damage',
        });
        pushEvent(q, { position: null, soundId: 'bang', type: 'playSound' });
        pushEvent(q, {
            normal: { x: 0, y: 1, z: 0 },
            position: { x: 5, y: 0, z: 5 },
            type: 'spawnDecal',
        });
        swapEventBuffers(q);
        expect(q.read).toHaveLength(3);
        expect(q.read[0]?.type).toBe('damage');
        expect(q.read[1]?.type).toBe('playSound');
        expect(q.read[2]?.type).toBe('spawnDecal');
    });
});
