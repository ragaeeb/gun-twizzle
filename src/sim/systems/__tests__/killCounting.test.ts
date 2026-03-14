/**
 * Regression test: killing one enemy must produce exactly one enemyDied event
 * and increment the mission kill count by exactly 1.
 *
 * Previously both damageSystem and aiSystem emitted enemyDied for the same
 * kill, causing the mission to complete after only 2 of 3 required kills.
 */
import { describe, expect, it } from 'vitest';

import { ENEMY_REGISTRY } from '../../../content/enemies/definitions';
import type { DamageEvent, SimEvent } from '../../events';
import { addTag, createEntity, createWorld } from '../../world';
import { aiSystem } from '../aiSystem';
import { applyDamageSystem } from '../damageSystem';
import { createMissionState, missionSystem } from '../missionSystem';

const setupLevel = () => {
    const world = createWorld();

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

    const spawnEnemy = (x: number, z: number) => {
        const id = createEntity(world);
        world.transform.set(id, {
            position: { x, y: 0, z },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
        });
        world.health.set(id, {
            current: 80,
            max: 80,
            shieldCurrent: 0,
            shieldMax: 0,
            shieldRechargeDelay: 0,
        });
        world.ai.set(id, {
            attackCooldown: 0,
            enemyDefId: 'grunt',
            patrolIndex: 0,
            patrolPath: [],
            spawnId: null,
            state: 'idle',
            targetEntityId: null,
        });
        addTag(world, id, 'enemy');
        return id;
    };

    const enemy1 = spawnEnemy(10, 0);
    const enemy2 = spawnEnemy(20, 0);
    const enemy3 = spawnEnemy(30, 0);

    return { enemy1, enemy2, enemy3, playerId, world };
};

const killEnemy = (
    world: ReturnType<typeof setupLevel>['world'],
    playerId: number,
    enemyId: number,
    outEvents: SimEvent[],
    dt = 1 / 60,
) => {
    const damageEvents: DamageEvent[] = [
        {
            amount: 999,
            hitNormal: { x: 0, y: 0, z: 0 },
            hitPoint: { x: 0, y: 0, z: 0 },
            isHeadshot: false,
            targetId: enemyId,
            type: 'damage',
        },
    ];

    applyDamageSystem(world, damageEvents, outEvents);
    aiSystem(world, playerId, ENEMY_REGISTRY, dt, outEvents);
};

describe('kill counting (regression)', () => {
    it('killing one enemy produces exactly one enemyDied event', () => {
        const { enemy1, playerId, world } = setupLevel();
        const events: SimEvent[] = [];

        killEnemy(world, playerId, enemy1, events);

        const diedEvents = events.filter((e) => e.type === 'enemyDied');
        expect(diedEvents).toHaveLength(1);
    });

    it('mission requires all 3 kills, not 2', () => {
        const { enemy1, enemy2, enemy3, playerId, world } = setupLevel();
        const mission = createMissionState({ params: { count: 3 }, type: 'kill_count' });

        // Kill enemy 1
        const events1: SimEvent[] = [];
        killEnemy(world, playerId, enemy1, events1);
        const out1: SimEvent[] = [];
        missionSystem(mission, events1, out1, 1 / 60);
        expect(mission.progress).toBe(1);
        expect(mission.isComplete).toBe(false);

        // Kill enemy 2
        const events2: SimEvent[] = [];
        killEnemy(world, playerId, enemy2, events2);
        const out2: SimEvent[] = [];
        missionSystem(mission, events2, out2, 1 / 60);
        expect(mission.progress).toBe(2);
        expect(mission.isComplete).toBe(false);

        // Kill enemy 3
        const events3: SimEvent[] = [];
        killEnemy(world, playerId, enemy3, events3);
        const out3: SimEvent[] = [];
        missionSystem(mission, events3, out3, 1 / 60);
        expect(mission.progress).toBe(3);
        expect(mission.isComplete).toBe(true);
    });
});
