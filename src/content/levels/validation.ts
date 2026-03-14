import { ENEMY_REGISTRY } from '../enemies/definitions';
import type { LevelDef } from './types';

export type ValidationError = {
    field: string;
    message: string;
};

const validateBasicFields = (level: LevelDef, errors: ValidationError[]): void => {
    if (!level.id) {
        errors.push({ field: 'id', message: 'Level must have an id' });
    }
    if (!level.name) {
        errors.push({ field: 'name', message: 'Level must have a name' });
    }
    if (!level.playerSpawn) {
        errors.push({ field: 'playerSpawn', message: 'Player spawn position is required' });
    }
    if (!level.missions || level.missions.length === 0) {
        errors.push({ field: 'missions', message: 'At least one mission objective is required' });
    }
};

const validateEnemies = (level: LevelDef, errors: ValidationError[]): Set<string> => {
    const seenSpawnIds = new Set<string>();
    for (let i = 0; i < level.enemies.length; i++) {
        const spawn = level.enemies[i]!;
        if (!ENEMY_REGISTRY[spawn.enemyDefId]) {
            errors.push({
                field: `enemies[${i}].enemyDefId`,
                message: `Unknown enemy definition: "${spawn.enemyDefId}"`,
            });
        }
        if (spawn.spawnId) {
            if (seenSpawnIds.has(spawn.spawnId)) {
                errors.push({
                    field: `enemies[${i}].spawnId`,
                    message: `Duplicate spawn ID: "${spawn.spawnId}"`,
                });
            }
            seenSpawnIds.add(spawn.spawnId);
        }
    }
    return seenSpawnIds;
};

const validatePickups = (level: LevelDef, errors: ValidationError[]): void => {
    const validPickupIds = new Set(['health', 'ammo', 'shield']);
    for (let i = 0; i < level.pickups.length; i++) {
        const pickup = level.pickups[i]!;
        if (!validPickupIds.has(pickup.pickupId)) {
            errors.push({
                field: `pickups[${i}].pickupId`,
                message: `Unknown pickup ID: "${pickup.pickupId}"`,
            });
        }
    }
};

const validateMissions = (level: LevelDef, seenSpawnIds: Set<string>, errors: ValidationError[]): void => {
    for (let i = 0; i < level.missions.length; i++) {
        const mission = level.missions[i]!;
        if (mission.type === 'kill_target') {
            if (!seenSpawnIds.has(mission.params.targetEnemySpawnId)) {
                errors.push({
                    field: `missions[${i}]`,
                    message: `kill_target references unknown spawnId: "${mission.params.targetEnemySpawnId}"`,
                });
            }
        }
    }
};

/**
 * Validate a level definition for common authoring errors.
 * Returns an array of errors (empty = valid).
 */
export const validateLevelDef = (level: LevelDef): ValidationError[] => {
    const errors: ValidationError[] = [];
    validateBasicFields(level, errors);
    const seenSpawnIds = validateEnemies(level, errors);
    validatePickups(level, errors);
    validateMissions(level, seenSpawnIds, errors);
    return errors;
};
