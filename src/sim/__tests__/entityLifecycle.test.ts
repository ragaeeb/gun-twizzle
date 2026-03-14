import { describe, expect, it } from 'vitest';

import { ENEMY_REGISTRY } from '../../content/enemies/definitions';
import { spawnEnemy } from '../systems/spawnSystem';
import { createEntity, createWorld, destroyEntity, getEntitiesWithTag, hasTag } from '../world';

describe('Entity lifecycle', () => {
    it('destroyEntity removes all components from the world', () => {
        const world = createWorld();
        const id = spawnEnemy(world, ENEMY_REGISTRY.grunt, { x: 0, y: 0, z: 0 });

        expect(world.transform.has(id)).toBe(true);
        expect(world.health.has(id)).toBe(true);
        expect(world.ai.has(id)).toBe(true);
        expect(hasTag(world, id, 'enemy')).toBe(true);

        destroyEntity(world, id);

        expect(world.transform.has(id)).toBe(false);
        expect(world.health.has(id)).toBe(false);
        expect(world.ai.has(id)).toBe(false);
        expect(world.tags.has(id)).toBe(false);
        expect(world.pickup.has(id)).toBe(false);
        expect(world.statusEffects.has(id)).toBe(false);
        expect(world.weaponOwner.has(id)).toBe(false);
    });

    it('destroyed entity no longer appears in tag queries', () => {
        const world = createWorld();
        const id1 = spawnEnemy(world, ENEMY_REGISTRY.grunt, { x: 0, y: 0, z: 0 });
        const id2 = spawnEnemy(world, ENEMY_REGISTRY.grunt, { x: 1, y: 0, z: 0 });

        expect(Array.from(getEntitiesWithTag(world, 'enemy'))).toHaveLength(2);

        destroyEntity(world, id1);

        const remaining = Array.from(getEntitiesWithTag(world, 'enemy'));
        expect(remaining).toHaveLength(1);
        expect(remaining[0]).toBe(id2);
    });

    it('destroying a non-existent entity is a no-op', () => {
        const world = createWorld();
        expect(() => destroyEntity(world, 999)).not.toThrow();
    });

    it('entity ids are unique and monotonically increasing', () => {
        const world = createWorld();
        const ids = Array.from({ length: 10 }, () => createEntity(world));
        const unique = new Set(ids);
        expect(unique.size).toBe(10);
        for (let i = 1; i < ids.length; i++) {
            expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
        }
    });
});
