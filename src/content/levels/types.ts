/**
 * Shared level definition types.
 */

export type MissionObjective =
    | { type: 'kill_count'; params: { count: number } }
    | { type: 'kill_target'; params: { targetEnemySpawnId: string } }
    | { type: 'reach_trigger'; params: { triggerId: string } }
    | { type: 'survive_timer'; params: { durationSeconds: number } };

export type EnemySpawn = {
    enemyDefId: string;
    patrolPath?: Array<{ x: number; y: number; z: number }>;
    position: { x: number; y: number; z: number };
    spawnId?: string; // unique identifier for target-kill missions
};

export type PickupSpawn = {
    pickupId: 'health' | 'ammo' | 'shield';
    position: { x: number; y: number; z: number };
};

export type WallDef = {
    color: number;
    position: { x: number; y: number; z: number };
    size: { depth: number; height: number; width: number };
};

export type LevelDef = {
    ambientColor: number;
    ambientIntensity: number;
    /** Key into AudioManager's loaded buffers. Played as a looping ambient track. */
    ambientSoundKey?: string;
    directionalColor: number;
    directionalIntensity: number;
    enemies: EnemySpawn[];
    groundColor: number;
    id: string;
    missions: MissionObjective[];
    name: string;
    pickups: PickupSpawn[];
    playerSpawn: { x: number; y: number; z: number };
    /** Sun elevation in degrees. High = midday, low = sunset, near-zero = night. */
    sunElevation: number;
    walls: WallDef[];
};
