import { describe, expect, it } from 'vitest';

import type { SimEvent } from '../../events';
import { createMissionState, missionSystem } from '../missionSystem';

describe('missionSystem', () => {
    it('increments progress on enemyDied event', () => {
        const state = createMissionState({ params: { count: 3 }, type: 'kill_count' });
        const events: SimEvent[] = [{ enemyId: 1, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.progress).toBe(1);
        expect(out).toHaveLength(1);
        expect(out[0]!.type).toBe('missionProgress');
    });

    it('marks mission complete when target count reached', () => {
        const state = createMissionState({ params: { count: 2 }, type: 'kill_count' });
        state.progress = 1;
        const events: SimEvent[] = [{ enemyId: 2, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.isComplete).toBe(true);
        expect(state.progress).toBe(2);
    });

    it('ignores events after completion', () => {
        const state = createMissionState({ params: { count: 1 }, type: 'kill_count' });
        state.isComplete = true;
        state.progress = 1;
        const events: SimEvent[] = [{ enemyId: 3, position: { x: 0, y: 0, z: 0 }, type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.progress).toBe(1); // unchanged
        expect(out).toHaveLength(0);
    });

    it('ignores non-enemyDied events', () => {
        const state = createMissionState({ params: { count: 3 }, type: 'kill_count' });
        const events: SimEvent[] = [{ position: null, soundId: 'boom', type: 'playSound' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.progress).toBe(0);
    });

    it('completes kill_target when matching spawnId is killed', () => {
        const state = createMissionState({ params: { targetEnemySpawnId: 'boss' }, type: 'kill_target' });
        const events: SimEvent[] = [{ enemyId: 4, position: { x: 0, y: 0, z: 0 }, spawnId: 'boss', type: 'enemyDied' }];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.isComplete).toBe(true);
        expect(state.progress).toBe(1);
    });

    it('ignores non-matching spawnId for kill_target', () => {
        const state = createMissionState({ params: { targetEnemySpawnId: 'boss' }, type: 'kill_target' });
        const events: SimEvent[] = [
            { enemyId: 5, position: { x: 0, y: 0, z: 0 }, spawnId: 'grunt', type: 'enemyDied' },
        ];
        const out: SimEvent[] = [];

        missionSystem(state, events, out, 1 / 60);

        expect(state.isComplete).toBe(false);
        expect(state.progress).toBe(0);
    });

    it('advances survive_timer missions by dt', () => {
        const state = createMissionState({ params: { durationSeconds: 2 }, type: 'survive_timer' });
        const out: SimEvent[] = [];

        missionSystem(state, [], out, 1);
        expect(state.isComplete).toBe(false);
        expect(state.elapsedSeconds).toBe(1);

        missionSystem(state, [], out, 1);
        expect(state.isComplete).toBe(true);
        expect(state.elapsedSeconds).toBe(2);
    });
});
