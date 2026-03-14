import { describe, expect, it } from 'vitest';

import type { SimEvent } from '../../events';
import { addTag, createEntity, createWorld } from '../../world';
import { pickupSystem } from '../pickupSystem';

const setupWorldWithPlayer = () => {
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
    return { playerId, world };
};

const spawnAmmoPickup = (world: ReturnType<typeof setupWorldWithPlayer>['world'], x = 0, z = 0) => {
    const pickupId = createEntity(world);
    world.transform.set(pickupId, {
        position: { x, y: 0, z },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
    });
    world.pickup.set(pickupId, { pickupId: 'ammo', respawnAt: null });
    addTag(world, pickupId, 'pickup');
    return pickupId;
};

describe('pickupSystem', () => {
    it('does not consume ammo pickup when equipped weapon has no ammo data', () => {
        const { playerId, world } = setupWorldWithPlayer();
        const pickupId = spawnAmmoPickup(world);

        world.weaponOwner.set(playerId, {
            ammo: { ak47: { magazine: 30, reserve: 90 } },
            equippedWeaponId: 'knife',
        });

        const events: SimEvent[] = [];
        pickupSystem(world, playerId, 0, events);

        expect(world.pickup.get(pickupId)?.respawnAt).toBeNull();
        expect(events).toHaveLength(0);
    });

    it('consumes ammo pickup when ammo data exists', () => {
        const { playerId, world } = setupWorldWithPlayer();
        const pickupId = spawnAmmoPickup(world);

        world.weaponOwner.set(playerId, {
            ammo: { ak47: { magazine: 30, reserve: 90 } },
            equippedWeaponId: 'ak47',
        });

        const events: SimEvent[] = [];
        pickupSystem(world, playerId, 0, events);

        expect(world.pickup.get(pickupId)?.respawnAt).toBeGreaterThan(0);
        expect(events.some((event) => event.type === 'pickupCollected')).toBe(true);
    });
});
