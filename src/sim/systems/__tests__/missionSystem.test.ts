import { describe, expect, it } from 'vitest';

import type { SimEvent } from '../../events';
import { createMissionState, missionSystem } from '../missionSystem';

describe('missionSystem', () => {
    it('increments progress on enemyDied event', () => {
        const state = createMissionState('eliminate', 3);
        const events: SimEvent[] = [{ enemyId: 1, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out);

        expect(state.killCount).toBe(1);
        expect(out).toHaveLength(1);
        expect(out[0]!.type).toBe('missionProgress');
    });

    it('marks mission complete when target count reached', () => {
        const state = createMissionState('eliminate', 2);
        state.killCount = 1;
        const events: SimEvent[] = [{ enemyId: 2, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out);

        expect(state.isComplete).toBe(true);
        expect(state.killCount).toBe(2);
    });

    it('ignores events after completion', () => {
        const state = createMissionState('eliminate', 1);
        state.isComplete = true;
        state.killCount = 1;
        const events: SimEvent[] = [{ enemyId: 3, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out);

        expect(state.killCount).toBe(1); // unchanged
        expect(out).toHaveLength(0);
    });

    it('ignores non-enemyDied events', () => {
        const state = createMissionState('eliminate', 3);
        const events: SimEvent[] = [{ position: null, soundId: 'boom', type: 'playSound' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out);

        expect(state.killCount).toBe(0);
    });
});
