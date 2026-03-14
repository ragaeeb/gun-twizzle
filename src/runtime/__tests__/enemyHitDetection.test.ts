import { describe, expect, it } from 'vitest';

import type { SimEvent } from '../../sim/events';
import { applyDamageSystem } from '../../sim/systems/damageSystem';
import { processHitScanResult } from '../../sim/systems/hitScanSystem';
import { addTag, createEntity, createWorld } from '../../sim/world';
import { findClosestEnemyHit, getSimWeaponDefForGameWeapon } from '../enemyHitDetection';
import { WeaponId } from '../types';

const addEnemy = (x: number, y: number, z: number, health = 90) => {
    const world = createWorld();
    const enemyId = createEntity(world);

    world.ai.set(enemyId, {
        attackCooldown: 0,
        enemyDefId: 'trainingDummy',
        patrolIndex: 0,
        patrolPath: [],
        state: 'idle',
        targetEntityId: null,
    });
    world.health.set(enemyId, { current: health, max: 90, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });
    world.transform.set(enemyId, {
        position: { x, y, z },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
    });
    addTag(world, enemyId, 'enemy');

    return { enemyId, world };
};

describe('findClosestEnemyHit', () => {
    it('uses a broader melee sweep than ranged hits', () => {
        const { enemyId, world } = addEnemy(0.85, 1, -1.6);
        const origin = { x: 0, y: 1.5, z: 0 };
        const direction = { x: 0, y: 0, z: -1 };

        const rifleHit = findClosestEnemyHit(world, origin, direction, WeaponId.AK47);
        const knifeHit = findClosestEnemyHit(world, origin, direction, WeaponId.KNIFE);

        expect(rifleHit).toBeNull();
        expect(knifeHit?.hitEntityId).toBe(enemyId);
    });

    it('lets the knife finish a low-health nearby enemy', () => {
        const { enemyId, world } = addEnemy(0.85, 1, -1.6, 6);
        const knifeDef = getSimWeaponDefForGameWeapon(WeaponId.KNIFE);
        const outEvents: SimEvent[] = [];

        const hit = findClosestEnemyHit(world, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, WeaponId.KNIFE);
        const damageEvent = hit ? processHitScanResult(hit, knifeDef) : null;

        expect(damageEvent).not.toBeNull();

        applyDamageSystem(world, [damageEvent!], outEvents);

        expect(world.health.get(enemyId)?.current).toBe(0);
        expect(outEvents.some((event) => event.type === 'enemyDied')).toBe(true);
    });
});
