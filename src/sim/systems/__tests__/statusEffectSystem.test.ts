import { describe, expect, it } from 'vitest';
import { createEntity, createWorld } from '../../world';
import { addEffect, applyShieldRegen, getEffectMagnitude, hasEffect, statusEffectSystem } from '../statusEffectSystem';

describe('statusEffectSystem', () => {
    it('ticks down effect durations', () => {
        const world = createWorld();
        const id = createEntity(world);
        addEffect(world, id, {
            id: 'speed1',
            magnitude: 1.5,
            remainingDuration: 3,
            type: 'speed_boost',
        });

        statusEffectSystem(world, 1);

        const comp = world.statusEffects.get(id)!;
        expect(comp.effects[0]!.remainingDuration).toBeCloseTo(2);
    });

    it('removes expired effects', () => {
        const world = createWorld();
        const id = createEntity(world);
        addEffect(world, id, {
            id: 'speed1',
            magnitude: 1.5,
            remainingDuration: 0.5,
            type: 'speed_boost',
        });

        statusEffectSystem(world, 1);

        const comp = world.statusEffects.get(id)!;
        expect(comp.effects.length).toBe(0);
    });

    it('does not expire permanent effects (duration -1)', () => {
        const world = createWorld();
        const id = createEntity(world);
        addEffect(world, id, {
            id: 'perm',
            magnitude: 2,
            remainingDuration: -1,
            type: 'golden_gun',
        });

        statusEffectSystem(world, 100);

        expect(hasEffect(world, id, 'golden_gun')).toBe(true);
    });

    it('hasEffect returns false for absent effects', () => {
        const world = createWorld();
        const id = createEntity(world);
        expect(hasEffect(world, id, 'damage_boost')).toBe(false);
    });

    it('getEffectMagnitude returns 0 for absent effects', () => {
        const world = createWorld();
        const id = createEntity(world);
        expect(getEffectMagnitude(world, id, 'speed_boost')).toBe(0);
    });

    it('replaces existing effect of same type', () => {
        const world = createWorld();
        const id = createEntity(world);
        addEffect(world, id, { id: 'a', magnitude: 1, remainingDuration: 5, type: 'speed_boost' });
        addEffect(world, id, { id: 'b', magnitude: 2, remainingDuration: 10, type: 'speed_boost' });

        expect(getEffectMagnitude(world, id, 'speed_boost')).toBe(2);
        expect(world.statusEffects.get(id)!.effects.length).toBe(1);
    });
});

describe('applyShieldRegen', () => {
    it('regenerates shield for entity with shield_regen effect', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, {
            current: 50,
            max: 100,
            shieldCurrent: 10,
            shieldMax: 50,
            shieldRechargeDelay: 0,
        });
        addEffect(world, id, {
            id: 'sr',
            magnitude: 5,
            remainingDuration: -1,
            type: 'shield_regen',
        });

        applyShieldRegen(world, 2);

        expect(world.health.get(id)!.shieldCurrent).toBe(20);
    });

    it('caps shield at shieldMax', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.health.set(id, {
            current: 100,
            max: 100,
            shieldCurrent: 48,
            shieldMax: 50,
            shieldRechargeDelay: 0,
        });
        addEffect(world, id, {
            id: 'sr',
            magnitude: 10,
            remainingDuration: -1,
            type: 'shield_regen',
        });

        applyShieldRegen(world, 1);

        expect(world.health.get(id)!.shieldCurrent).toBe(50);
    });
});
