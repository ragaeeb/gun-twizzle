import type { LevelDef } from '../../content/levels/types';
import type { SimEvent } from '../events';

export type MissionState = {
    isComplete: boolean;
    mission: LevelDef['missions'][number];
    progress: number;
    elapsedSeconds: number;
};

type SurviveMission = Extract<LevelDef['missions'][number], { type: 'survive_timer' }>;
type KillMission = Extract<LevelDef['missions'][number], { type: 'kill_count' | 'kill_target' }>;

export const createMissionState = (mission: LevelDef['missions'][number]): MissionState => ({
    elapsedSeconds: 0,
    isComplete: false,
    mission,
    progress: 0,
});

const pushMissionProgress = (
    outEvents: SimEvent[],
    missionId: MissionState['mission']['type'],
    payload: Record<string, unknown>,
) => {
    outEvents.push({
        missionId,
        payload,
        type: 'missionProgress',
    });
};

const handleSurviveTimer = (
    state: MissionState,
    mission: SurviveMission,
    outEvents: SimEvent[],
    dt: number,
) => {
    state.elapsedSeconds += dt;
    if (state.elapsedSeconds < mission.params.durationSeconds) {
        return;
    }

    state.isComplete = true;
    pushMissionProgress(outEvents, mission.type, {
        durationSeconds: mission.params.durationSeconds,
        elapsedSeconds: state.elapsedSeconds,
        isComplete: true,
    });
};

const countKillEvents = (events: SimEvent[], targetSpawnId?: string) => {
    let matchedKills = 0;
    for (const event of events) {
        if (event?.type !== 'enemyDied') {
            continue;
        }
        if (targetSpawnId && event.spawnId !== targetSpawnId) {
            continue;
        }
        matchedKills += 1;
    }
    return matchedKills;
};

const handleKillMission = (state: MissionState, mission: KillMission, events: SimEvent[], outEvents: SimEvent[]) => {
    const targetSpawnId = mission.type === 'kill_target' ? mission.params.targetEnemySpawnId : undefined;
    const matchedKills = countKillEvents(events, targetSpawnId);
    if (matchedKills === 0) {
        return;
    }

    state.progress += matchedKills;
    const targetCount = mission.type === 'kill_count' ? mission.params.count : 1;
    const isComplete = state.progress >= targetCount;
    if (isComplete) {
        state.isComplete = true;
    }

    pushMissionProgress(outEvents, mission.type, {
        isComplete,
        killCount: state.progress,
        targetCount,
        targetEnemySpawnId: targetSpawnId,
    });
};

/**
 * Process enemy death events and track mission progress.
 */
export const missionSystem = (state: MissionState, events: SimEvent[], outEvents: SimEvent[], dt: number): void => {
    if (state.isComplete) {
        return;
    }

    switch (state.mission.type) {
        case 'survive_timer':
            handleSurviveTimer(state, state.mission, outEvents, dt);
            break;
        case 'kill_count':
        case 'kill_target':
            handleKillMission(state, state.mission, events, outEvents);
            break;
        default:
            break;
    }
};
