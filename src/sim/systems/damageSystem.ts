import type { DamageEvent, SimEvent } from '../events';
import type { World } from '../world';
import { hasTag } from '../world';

const applyShieldReduction = (damage: number, shieldCurrent: number): number => {
    if (shieldCurrent > 0) {
        return damage * 0.5;
    }
    return damage;
};

const tryEmitDeathEvent = (world: World, targetId: number, outEvents: SimEvent[]): void => {
    if (hasTag(world, targetId, 'enemy')) {
        const transform = world.transform.get(targetId);
        if (transform) {
            outEvents.push({
                enemyId: targetId,
                position: { ...transform.position },
                type: 'enemyDied',
            });
        }
    }
};

/**
 * Process damage events: reduce health, emit death events.
 * Shield provides 50% damage reduction when active.
 */
export const applyDamageSystem = (world: World, damageEvents: DamageEvent[], outEvents: SimEvent[]): void => {
    for (const event of damageEvents) {
        const health = world.health.get(event.targetId);
        if (!health) {
            continue;
        }

        let damage = event.amount * (event.isHeadshot ? 2.0 : 1.0);
        damage = applyShieldReduction(damage, health.shieldCurrent);
        health.current = Math.max(0, health.current - damage);

        if (health.current <= 0) {
            tryEmitDeathEvent(world, event.targetId, outEvents);
        }
    }
};
