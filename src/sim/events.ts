export type EntityId = number;

export type DamageEvent = {
    amount: number;
    hitNormal: { x: number; y: number; z: number };
    hitPoint: { x: number; y: number; z: number };
    isHeadshot: boolean;
    targetId: EntityId;
    type: 'damage';
};

export type PlaySoundEvent = {
    position: { x: number; y: number; z: number } | null;
    soundId: string;
    type: 'playSound';
    volume?: number;
};

export type SpawnDecalEvent = {
    normal: { x: number; y: number; z: number };
    position: { x: number; y: number; z: number };
    type: 'spawnDecal';
};

export type EnemyDiedEvent = {
    enemyId: EntityId;
    position: { x: number; y: number; z: number };
    type: 'enemyDied';
};

export type PickupCollectedEvent = {
    collectorId: EntityId;
    pickupId: string;
    type: 'pickupCollected';
};

export type MissionProgressEvent = {
    missionId: string;
    payload: Record<string, unknown>;
    type: 'missionProgress';
};

export type SimEvent =
    | DamageEvent
    | EnemyDiedEvent
    | MissionProgressEvent
    | PickupCollectedEvent
    | PlaySoundEvent
    | SpawnDecalEvent;

/**
 * Double-buffered event queue.
 * Systems write to `write`. After the sim step, call `swap()`.
 * Adapters then read from `read`. No per-tick array allocation.
 */
export type EventQueue = {
    read: SimEvent[];
    write: SimEvent[];
};

export const createEventQueue = (): EventQueue => ({
    read: [],
    write: [],
});

export const pushEvent = (queue: EventQueue, event: SimEvent): void => {
    queue.write.push(event);
};

/**
 * Swap buffers. After calling this:
 * - `queue.read` contains the events from the last tick (for adapters to consume)
 * - `queue.write` is empty and ready for the next tick's systems
 *
 * Adapters MUST finish consuming `queue.read` before the next `swap()` call.
 */
export const swapEventBuffers = (queue: EventQueue): void => {
    const prev = queue.read;
    queue.read = queue.write;
    queue.write = prev;
    queue.write.length = 0;
};
