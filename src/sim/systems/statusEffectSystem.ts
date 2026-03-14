import type { EntityId, StatusEffectType, World } from '../world';

export type StatusEffect = {
    id: string;
    magnitude: number;
    remainingDuration: number; // seconds, -1 for permanent
    type: StatusEffectType;
};

export type StatusEffectComponent = {
    effects: StatusEffect[];
};

/**
 * Tick all status effects: decrement durations, remove expired.
 */
export const statusEffectSystem = (world: World, dt: number): void => {
    for (const [_entityId, comp] of world.statusEffects.entries()) {
        tickEffects(comp, dt);
    }
};

const tickEffects = (comp: StatusEffectComponent, dt: number): void => {
    for (let i = comp.effects.length - 1; i >= 0; i--) {
        const effect = comp.effects[i]!;
        if (effect.remainingDuration < 0) {
            continue; // permanent
        }
        effect.remainingDuration -= dt;
        if (effect.remainingDuration <= 0) {
            comp.effects.splice(i, 1);
        }
    }
};

/**
 * Apply shield regeneration for entities with shield_regen effect.
 */
export const applyShieldRegen = (world: World, dt: number): void => {
    for (const [entityId, comp] of world.statusEffects.entries()) {
        const regenEffect = comp.effects.find((e) => e.type === 'shield_regen');
        if (!regenEffect) {
            continue;
        }

        const health = world.health.get(entityId);
        if (!health || health.shieldMax <= 0) {
            continue;
        }

        health.shieldCurrent = Math.min(health.shieldMax, health.shieldCurrent + regenEffect.magnitude * dt);
    }
};

export const hasEffect = (world: World, entityId: EntityId, effectType: StatusEffectType): boolean => {
    const comp = world.statusEffects.get(entityId);
    if (!comp) {
        return false;
    }
    return comp.effects.some((e) => e.type === effectType);
};

export const addEffect = (world: World, entityId: EntityId, effect: StatusEffect): void => {
    let comp = world.statusEffects.get(entityId);
    if (!comp) {
        comp = { effects: [] };
        world.statusEffects.set(entityId, comp);
    }
    // Replace existing effect of same type
    const idx = comp.effects.findIndex((e) => e.type === effect.type);
    if (idx >= 0) {
        comp.effects[idx] = effect;
    } else {
        comp.effects.push(effect);
    }
};

export const getEffectMagnitude = (world: World, entityId: EntityId, effectType: StatusEffectType): number => {
    const comp = world.statusEffects.get(entityId);
    if (!comp) {
        return 0;
    }
    const effect = comp.effects.find((e) => e.type === effectType);
    return effect?.magnitude ?? 0;
};
