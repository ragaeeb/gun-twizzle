import { describe, expect, it } from 'vitest';
import type { EnemyId } from '../../enemies/definitions';
import { LEVEL_1 } from '../level1';
import { LEVEL_2 } from '../level2';
import { LEVEL_3 } from '../level3';
import { LEVEL_4 } from '../level4';
import type { LevelDef } from '../types';
import { type ValidationError, validateLevelDef } from '../validation';

describe('Level validation', () => {
    it('Level 1 passes validation', () => {
        const errors = validateLevelDef(LEVEL_1);
        expect(errors).toEqual([]);
    });

    it('Level 2 passes validation', () => {
        const errors = validateLevelDef(LEVEL_2);
        expect(errors).toEqual([]);
    });

    it('Level 3 passes validation', () => {
        const errors = validateLevelDef(LEVEL_3);
        expect(errors).toEqual([]);
    });

    it('Level 4 passes validation', () => {
        const errors = validateLevelDef(LEVEL_4);
        expect(errors).toEqual([]);
    });

    it('detects unknown enemy def', () => {
        const badLevel: LevelDef = {
            ...LEVEL_1,
            enemies: [{ enemyDefId: 'alien' as EnemyId, position: { x: 0, y: 0, z: 0 } }],
        };
        const errors = validateLevelDef(badLevel);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]!.message).toContain('alien');
    });

    it('detects duplicate spawn IDs', () => {
        const badLevel: LevelDef = {
            ...LEVEL_1,
            enemies: [
                { enemyDefId: 'grunt', position: { x: 0, y: 0, z: 0 }, spawnId: 'boss' },
                { enemyDefId: 'grunt', position: { x: 5, y: 0, z: 0 }, spawnId: 'boss' },
            ],
        };
        const errors = validateLevelDef(badLevel);
        expect(errors.some((e: ValidationError) => e.message.includes('Duplicate'))).toBe(true);
    });

    it('detects missing mission objectives', () => {
        const badLevel: LevelDef = { ...LEVEL_1, missions: [] };
        const errors = validateLevelDef(badLevel);
        expect(errors.some((e: ValidationError) => e.field === 'missions')).toBe(true);
    });
});
