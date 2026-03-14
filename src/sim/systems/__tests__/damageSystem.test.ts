import { describe, expect, it } from 'vitest';

import type { DamageEvent, SimEvent } from '../../events';
import { addTag, createEntity, createWorld } from '../../world';
import { applyDamageSystem } from '../damageSystem';

describe('applyDamageSystem', () => {
    it('reduces health by damage amount', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, { current: 100, max: 100, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });

        const events: DamageEvent[] = [
            {
                amount: 30,
                hitNormal: { x: 0, y: 0, z: 0 },
                hitPoint: { x: 0, y: 0, z: 0 },
                isHeadshot: false,
                targetId: id,
                type: 'damage',
            },
        ];
        const out: SimEvent[] = [];

        applyDamageSystem(world, events, out);

        expect(world.health.get(id)?.current).toBe(70);
    });

    it('applies headshot multiplier', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, { current: 100, max: 100, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });

        const events: DamageEvent[] = [
            {
                amount: 30,
                hitNormal: { x: 0, y: 0, z: 0 },
                hitPoint: { x: 0, y: 0, z: 0 },
                isHeadshot: true,
                targetId: id,
                type: 'damage',
            },
        ];
        const out: SimEvent[] = [];

        applyDamageSystem(world, events, out);

        expect(world.health.get(id)?.current).toBe(40); // 100 - 30*2
    });

    it('clamps health at 0', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, { current: 10, max: 100, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });

        const events: DamageEvent[] = [
            {
                amount: 50,
                hitNormal: { x: 0, y: 0, z: 0 },
                hitPoint: { x: 0, y: 0, z: 0 },
                isHeadshot: false,
                targetId: id,
                type: 'damage',
            },
        ];
        const out: SimEvent[] = [];

        applyDamageSystem(world, events, out);

        expect(world.health.get(id)?.current).toBe(0);
    });

    it('emits enemyDied event when enemy health reaches 0', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, { current: 10, max: 80, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });
        world.transform.set(id, { position: { x: 5, y: 0, z: 3 }, rotation: { w: 1, x: 0, y: 0, z: 0 } });
        addTag(world, id, 'enemy');

        const events: DamageEvent[] = [
            {
                amount: 20,
                hitNormal: { x: 0, y: 0, z: 0 },
                hitPoint: { x: 0, y: 0, z: 0 },
                isHeadshot: false,
                targetId: id,
                type: 'damage',
            },
        ];
        const out: SimEvent[] = [];

        applyDamageSystem(world, events, out);

        expect(out).toHaveLength(1);
        expect(out[0]!.type).toBe('enemyDied');
    });

    it('does not emit event for non-enemy entities', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, { current: 10, max: 100, shieldCurrent: 0, shieldMax: 0, shieldRechargeDelay: 0 });
        world.transform.set(id, { position: { x: 0, y: 0, z: 0 }, rotation: { w: 1, x: 0, y: 0, z: 0 } });
        // no 'enemy' tag

        const events: DamageEvent[] = [
            {
                amount: 50,
                hitNormal: { x: 0, y: 0, z: 0 },
                hitPoint: { x: 0, y: 0, z: 0 },
                isHeadshot: false,
                targetId: id,
                type: 'damage',
            },
        ];
        const out: SimEvent[] = [];

        applyDamageSystem(world, events, out);

        expect(out).toHaveLength(0);
    });
});
