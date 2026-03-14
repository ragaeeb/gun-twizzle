import type { SimEvent } from '../events';

export type MissionState = {
    isComplete: boolean;
    killCount: number;
    missionId: string;
    targetCount: number;
};

export const createMissionState = (missionId: string, targetCount: number): MissionState => ({
    isComplete: false,
    killCount: 0,
    missionId,
    targetCount,
});

/**
 * Process enemy death events and track mission progress.
 */
export const missionSystem = (state: MissionState, events: SimEvent[], outEvents: SimEvent[]): void => {
    if (state.isComplete) {
        return;
    }

    const eventCount = events.length;
    for (let index = 0; index < eventCount; index += 1) {
        const event = events[index];
        if (!event) {
            continue;
        }
        if (event.type !== 'enemyDied') {
            continue;
        }

        state.killCount += 1;

        outEvents.push({
            missionId: state.missionId,
            payload: {
                isComplete: state.killCount >= state.targetCount,
                killCount: state.killCount,
                targetCount: state.targetCount,
            },
            type: 'missionProgress',
        });

        if (state.killCount >= state.targetCount) {
            state.isComplete = true;
            break;
        }
    }
};
