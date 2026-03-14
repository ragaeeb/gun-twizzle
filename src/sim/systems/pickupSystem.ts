import type { SimEvent } from '../events';
import type { EntityId, PickupComponent, World } from '../world';
import { getEntitiesWithTag } from '../world';

const PICKUP_COLLECT_RADIUS_SQ = 4; // 2 units radius squared
export const HEALTH_RESTORE = 25;
export const AMMO_RESTORE = 30;
export const SHIELD_RESTORE = 50;
const RESPAWN_DELAY = 15; // seconds

export type PickupType = 'health' | 'ammo' | 'shield';

const tryCollectHealth = (world: World, playerEntityId: EntityId): boolean => {
    const health = world.health.get(playerEntityId);
    if (!health || health.current >= health.max) {
        return false;
    }
    health.current = Math.min(health.max, health.current + HEALTH_RESTORE);
    return true;
};

const tryCollectAmmo = (world: World, playerEntityId: EntityId): boolean => {
    const weaponOwner = world.weaponOwner.get(playerEntityId);
    if (!weaponOwner) {
        return false;
    }
    const ammoData = weaponOwner.ammo[weaponOwner.equippedWeaponId];
    if (ammoData) {
        ammoData.reserve += AMMO_RESTORE;
    }
    return true;
};

const tryCollectShield = (world: World, playerEntityId: EntityId): boolean => {
    const health = world.health.get(playerEntityId);
    if (!health) {
        return false;
    }
    // Shield pickup gives shield capacity and fills it
    health.shieldMax = Math.max(health.shieldMax, SHIELD_RESTORE);
    health.shieldCurrent = health.shieldMax;
    return true;
};

const isInRange = (
    playerPos: { x: number; y: number; z: number },
    pickupPos: { x: number; y: number; z: number },
): boolean => {
    const dx = playerPos.x - pickupPos.x;
    const dz = playerPos.z - pickupPos.z;
    return dx * dx + dz * dz <= PICKUP_COLLECT_RADIUS_SQ;
};

const tryRespawn = (pickup: PickupComponent, simTime: number): boolean => {
    if (pickup.respawnAt === null) {
        return false;
    }
    if (simTime >= pickup.respawnAt) {
        pickup.respawnAt = null;
        return false;
    }
    return true; // still in respawn state (skip collection)
};

const tryCollect = (world: World, playerEntityId: EntityId, pickupId: string): boolean => {
    const pickupType = pickupId as PickupType;
    if (pickupType === 'health') {
        return tryCollectHealth(world, playerEntityId);
    }
    if (pickupType === 'ammo') {
        return tryCollectAmmo(world, playerEntityId);
    }
    if (pickupType === 'shield') {
        return tryCollectShield(world, playerEntityId);
    }
    return false;
};

export const pickupSystem = (
    world: World,
    playerEntityId: EntityId | null,
    simTime: number,
    outEvents: SimEvent[],
): void => {
    if (playerEntityId === null) {
        return;
    }

    const playerTransform = world.transform.get(playerEntityId);
    if (!playerTransform) {
        return;
    }

    for (const entityId of getEntitiesWithTag(world, 'pickup')) {
        const pickup = world.pickup.get(entityId);
        const transform = world.transform.get(entityId);

        if (!pickup || !transform) {
            continue;
        }

        if (tryRespawn(pickup, simTime)) {
            continue;
        }

        if (!isInRange(playerTransform.position, transform.position)) {
            continue;
        }

        if (tryCollect(world, playerEntityId, pickup.pickupId)) {
            pickup.respawnAt = simTime + RESPAWN_DELAY;
            outEvents.push({
                collectorId: playerEntityId,
                pickupId: pickup.pickupId,
                type: 'pickupCollected',
            });
        }
    }
};
