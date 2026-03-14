import { describe, expect, it } from 'vitest';

import { addTag, createEntity, createWorld, destroyEntity, getEntitiesWithTag, hasTag } from '../world';

describe('World', () => {
    it('createEntity returns incrementing IDs starting from 1', () => {
        const world = createWorld();
        const a = createEntity(world);
        const b = createEntity(world);
        expect(a).toBe(1);
        expect(b).toBe(2);
    });

    it('destroyEntity removes all components', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.transform.set(id, {
            position: { x: 0, y: 0, z: 0 },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
        });
        world.health.set(id, {
            current: 100,
            max: 100,
            shieldCurrent: 0,
            shieldMax: 0,
            shieldRechargeDelay: 0,
        });
        addTag(world, id, 'player');

        destroyEntity(world, id);

        expect(world.transform.has(id)).toBe(false);
        expect(world.health.has(id)).toBe(false);
        expect(world.tags.has(id)).toBe(false);
    });

    it('destroyEntity is safe to call on entity without components', () => {
        const world = createWorld();
        const id = createEntity(world);
        expect(() => destroyEntity(world, id)).not.toThrow();
    });

    it('tags can be added and queried', () => {
        const world = createWorld();
        const id = createEntity(world);
        addTag(world, id, 'enemy');
        expect(hasTag(world, id, 'enemy')).toBe(true);
        expect(hasTag(world, id, 'player')).toBe(false);
    });

    it('hasTag returns false for non-existent entity', () => {
        const world = createWorld();
        expect(hasTag(world, 999, 'enemy')).toBe(false);
    });

    it('multiple tags can be added to the same entity', () => {
        const world = createWorld();
        const id = createEntity(world);
        addTag(world, id, 'enemy');
        addTag(world, id, 'boss');
        expect(hasTag(world, id, 'enemy')).toBe(true);
        expect(hasTag(world, id, 'boss')).toBe(true);
    });

    it('getEntitiesWithTag returns correct entities', () => {
        const world = createWorld();
        const a = createEntity(world);
        const b = createEntity(world);
        const c = createEntity(world);
        addTag(world, a, 'enemy');
        addTag(world, b, 'enemy');
        addTag(world, c, 'player');

        const enemies = getEntitiesWithTag(world, 'enemy');
        expect(enemies).toHaveLength(2);
        expect(enemies).toContain(a);
        expect(enemies).toContain(b);
    });

    it('getEntitiesWithTag returns empty for unknown tag', () => {
        const world = createWorld();
        createEntity(world);
        expect(getEntitiesWithTag(world, 'nonexistent')).toHaveLength(0);
    });

    it('ComponentStore.entries yields only populated entries', () => {
        const world = createWorld();
        const a = createEntity(world);
        createEntity(world); // b — no components
        const c = createEntity(world);
        world.health.set(a, {
            current: 50,
            max: 100,
            shieldCurrent: 0,
            shieldMax: 0,
            shieldRechargeDelay: 0,
        });
        world.health.set(c, {
            current: 75,
            max: 100,
            shieldCurrent: 0,
            shieldMax: 0,
            shieldRechargeDelay: 0,
        });

        const entries = [...world.health.entries()];
        expect(entries).toHaveLength(2);
    });

    it('ComponentStore operations are independent per store', () => {
        const world = createWorld();
        const id = createEntity(world);
        world.transform.set(id, {
            position: { x: 1, y: 2, z: 3 },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
        });

        // health store should not be affected
        expect(world.health.has(id)).toBe(false);
        expect(world.transform.has(id)).toBe(true);
    });
});
