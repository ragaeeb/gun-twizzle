import { describe, expect, it } from 'vitest';

import { ENEMY_REGISTRY } from '../../../content/enemies/definitions';
import type { WallDef } from '../../../content/levels/types';
import type { SimEvent } from '../../events';
import { addTag, createEntity, createWorld } from '../../world';
import { aiSystem } from '../aiSystem';

const createTestWorld = () => {
    const world = createWorld();
    // Create player
    const playerId = createEntity(world);
    world.transform.set(playerId, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
    });
    world.health.set(playerId, {
        current: 100,
        max: 100,
        shieldCurrent: 0,
        shieldMax: 0,
        shieldRechargeDelay: 0,
    });
    addTag(world, playerId, 'player');

    // Create enemy
    const enemyId = createEntity(world);
    world.transform.set(enemyId, {
        position: { x: 50, y: 0, z: 0 },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
    });
    world.health.set(enemyId, {
        current: 80,
        max: 80,
        shieldCurrent: 0,
        shieldMax: 0,
        shieldRechargeDelay: 0,
    });
    world.ai.set(enemyId, {
        attackCooldown: 0,
        enemyDefId: 'grunt',
        patrolIndex: 0,
        patrolPath: [],
        state: 'idle',
        targetEntityId: null,
    });
    addTag(world, enemyId, 'enemy');

    return { enemyId, playerId, world };
};

const blockingWall: WallDef = {
    color: 0xffffff,
    position: { x: 49, y: 2, z: 0 },
    size: { depth: 4, height: 4, width: 1 },
};

describe('aiSystem', () => {
    it('stays idle when player is out of detection range', () => {
        const { enemyId, playerId, world } = createTestWorld();
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('idle');
    });

    it('transitions from idle to chase when player is within detection range', () => {
        const { enemyId, playerId, world } = createTestWorld();
        // Move player close to enemy
        world.transform.get(playerId)!.position.x = 40; // within 25 units of enemy at x=50
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('chase');
    });

    it('transitions from chase to attack when player is within attack range', () => {
        const { enemyId, playerId, world } = createTestWorld();
        // Move player very close
        world.transform.get(playerId)!.position.x = 45; // within 20 units of enemy at x=50
        world.ai.get(enemyId)!.state = 'chase';
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('attack');
    });

    it('transitions to dead when health reaches 0 (no duplicate enemyDied)', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.health.get(enemyId)!.current = 0;
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('dead');
        expect(events.filter((e) => e.type === 'enemyDied')).toHaveLength(0);
    });

    it('returns to idle when player leaves 1.5x detection range', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.ai.get(enemyId)!.state = 'chase';
        // Move player far away (> 25 * 1.5 = 37.5 units from enemy at x=50)
        world.transform.get(playerId)!.position.x = 0; // 50 units away
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('idle');
    });

    it('emits damage event when attacking on cooldown', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.transform.get(playerId)!.position.x = 48; // very close
        world.ai.get(enemyId)!.state = 'attack';
        world.ai.get(enemyId)!.attackCooldown = 0;
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        const damageEvent = events.find((e) => e.type === 'damage');
        expect(damageEvent).toBeDefined();
    });

    it('emits an enemy fire sound when attacking on cooldown', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.transform.get(playerId)!.position.x = 48;
        world.ai.get(enemyId)!.state = 'attack';
        world.ai.get(enemyId)!.attackCooldown = 0;
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        const soundEvent = events.find((event) => event.type === 'playSound');
        expect(soundEvent).toEqual({
            position: { x: 50, y: 0, z: 0 },
            soundId: 'gunshot',
            type: 'playSound',
            volume: 0.75,
        });
    });

    it('does not emit damage when a wall blocks line of sight', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.transform.get(playerId)!.position.x = 48;
        world.ai.get(enemyId)!.state = 'attack';
        world.ai.get(enemyId)!.attackCooldown = 0;
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events, [blockingWall]);

        expect(world.ai.get(enemyId)?.state).toBe('chase');
        expect(events).toEqual([]);
    });

    it('keeps dormant enemies idle even when the player is nearby', () => {
        const { enemyId, playerId, world } = createTestWorld();
        world.ai.get(enemyId)!.enemyDefId = 'trainingDummy';
        world.transform.get(playerId)!.position.x = 49;
        const events: SimEvent[] = [];

        aiSystem(world, playerId, ENEMY_REGISTRY, 1 / 60, events);

        expect(world.ai.get(enemyId)?.state).toBe('idle');
        expect(events).toEqual([]);
    });
});
