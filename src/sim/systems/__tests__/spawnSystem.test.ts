import { describe, expect, it } from 'vitest';

import { ENEMY_REGISTRY } from '../../../content/enemies/definitions';
import { createWorld } from '../../world';
import { spawnEnemy } from '../spawnSystem';

const gruntDef = ENEMY_REGISTRY.grunt;

describe('spawnSystem', () => {
    it('creates an entity with all expected components', () => {
        if (!gruntDef) {
            throw new Error('grunt def missing');
        }
        const world = createWorld();
        const id = spawnEnemy(world, gruntDef, { x: 10, y: 0, z: 5 });

        expect(world.transform.get(id)).toBeDefined();
        expect(world.health.get(id)).toBeDefined();
        expect(world.ai.get(id)).toBeDefined();
        expect(world.tags.get(id)?.has('enemy')).toBe(true);
    });

    it('sets health to enemy definition values', () => {
        if (!gruntDef) {
            throw new Error('grunt def missing');
        }
        const world = createWorld();
        const id = spawnEnemy(world, gruntDef, { x: 0, y: 0, z: 0 });

        const health = world.health.get(id);
        expect(health?.current).toBe(gruntDef.health);
        expect(health?.max).toBe(gruntDef.health);
    });

    it('sets position correctly', () => {
        if (!gruntDef) {
            throw new Error('grunt def missing');
        }
        const world = createWorld();
        const pos = { x: 5, y: 2, z: -3 };
        const id = spawnEnemy(world, gruntDef, pos);

        const transform = world.transform.get(id);
        expect(transform?.position).toEqual(pos);
    });

    it('starts in idle when no patrol path given', () => {
        if (!gruntDef) {
            throw new Error('grunt def missing');
        }
        const world = createWorld();
        const id = spawnEnemy(world, gruntDef, { x: 0, y: 0, z: 0 });

        expect(world.ai.get(id)?.state).toBe('idle');
    });

    it('starts in patrol when patrol path given', () => {
        if (!gruntDef) {
            throw new Error('grunt def missing');
        }
        const world = createWorld();
        const path = [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
        ];
        const id = spawnEnemy(world, gruntDef, { x: 0, y: 0, z: 0 }, path);

        expect(world.ai.get(id)?.state).toBe('patrol');
        expect(world.ai.get(id)?.patrolPath).toEqual(path);
    });
});
