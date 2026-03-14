import type * as Rapier from '@dimforge/rapier3d-compat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    type CharacterControllerHandle,
    createCharacterController,
    DEFAULT_PLAYER_CONFIG,
    moveCharacter,
} from '../characterController';
import { WORLD_GROUP } from '../collisionLayers';

let rapier: typeof Rapier;
const worlds: Rapier.World[] = [];

const stepWorld = (world: Rapier.World, steps = 1) => {
    for (let i = 0; i < steps; i += 1) {
        world.step();
    }
};

const createWorld = () => {
    const world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    worlds.push(world);
    return world;
};

const createGround = (world: Rapier.World) => {
    const rigidBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    const colliderDesc = rapier.ColliderDesc.cuboid(10, 0.1, 10).setCollisionGroups(WORLD_GROUP);
    world.createCollider(colliderDesc, rigidBody);
};

const createWall = (world: Rapier.World, position: { x: number; y: number; z: number }) => {
    const rigidBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    const colliderDesc = rapier.ColliderDesc.cuboid(0.5, 1, 0.5).setCollisionGroups(WORLD_GROUP);
    world.createCollider(colliderDesc, rigidBody);
};

const createStep = (world: Rapier.World, height: number, position: { x: number; y: number; z: number }) => {
    const rigidBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    const colliderDesc = rapier.ColliderDesc.cuboid(0.5, height / 2, 0.5).setCollisionGroups(WORLD_GROUP);
    world.createCollider(colliderDesc, rigidBody);
};

const getCapsuleRestHeight = () => {
    const halfHeight = DEFAULT_PLAYER_CONFIG.height / 2 - DEFAULT_PLAYER_CONFIG.radius;
    return halfHeight + DEFAULT_PLAYER_CONFIG.radius;
};

const settleOnGround = (world: Rapier.World, handle: CharacterControllerHandle) => {
    world.step();
    const grounded = moveCharacter(handle, { x: 0, y: -2, z: 0 });
    stepWorld(world, 2);
    return grounded;
};

beforeAll(async () => {
    rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
});

afterEach(() => {
    for (const world of worlds.splice(0)) {
        world.free();
    }
});

describe('CharacterController', () => {
    describe('DEFAULT_PLAYER_CONFIG', () => {
        it('has reasonable defaults', () => {
            expect(DEFAULT_PLAYER_CONFIG.height).toBe(1.8);
            expect(DEFAULT_PLAYER_CONFIG.radius).toBe(0.3);
            expect(DEFAULT_PLAYER_CONFIG.maxSlopeAngleDeg).toBe(45);
            expect(DEFAULT_PLAYER_CONFIG.autoStepMaxHeight).toBe(0.3);
            expect(DEFAULT_PLAYER_CONFIG.autoStepMinWidth).toBe(0.2);
            expect(DEFAULT_PLAYER_CONFIG.snapToGroundDistance).toBe(0.1);
        });

        it('capsule half-height is positive', () => {
            const halfHeight = DEFAULT_PLAYER_CONFIG.height / 2 - DEFAULT_PLAYER_CONFIG.radius;
            expect(halfHeight).toBeGreaterThan(0);
        });

        it('radius is less than half height', () => {
            expect(DEFAULT_PLAYER_CONFIG.radius).toBeLessThan(DEFAULT_PLAYER_CONFIG.height / 2);
        });
    });

    it('creates a valid controller and grounds on flat surface', () => {
        const world = createWorld();
        createGround(world);

        const startPosition = { x: 0, y: 1.2, z: 0 };
        const handle = createCharacterController(rapier, world, DEFAULT_PLAYER_CONFIG, startPosition);

        const grounded = settleOnGround(world, handle);
        const position = handle.rigidBody.translation();

        expect(handle.collider).toBeDefined();
        expect(handle.controller).toBeDefined();
        expect(handle.rigidBody).toBeDefined();
        expect(grounded).toBe(true);
        expect(position.y).toBeGreaterThanOrEqual(getCapsuleRestHeight() - 0.05);
    });

    it('moves along flat ground without losing grounded state', () => {
        const world = createWorld();
        createGround(world);

        const handle = createCharacterController(rapier, world, DEFAULT_PLAYER_CONFIG, { x: 0, y: 1.2, z: 0 });
        settleOnGround(world, handle);

        world.step();
        const grounded = moveCharacter(handle, { x: 1, y: 0, z: 0 });
        stepWorld(world, 2);
        const position = handle.rigidBody.translation();

        expect(grounded).toBe(true);
        expect(position.x).toBeGreaterThan(0.5);
        expect(position.y).toBeGreaterThanOrEqual(getCapsuleRestHeight() - 0.05);
    });

    it('blocks movement when hitting a static obstacle', () => {
        const world = createWorld();
        createGround(world);
        createWall(world, { x: 1.2, y: 1, z: 0 });

        const handle = createCharacterController(rapier, world, DEFAULT_PLAYER_CONFIG, { x: 0, y: 1.2, z: 0 });
        settleOnGround(world, handle);

        world.step();
        moveCharacter(handle, { x: 2, y: 0, z: 0 });
        stepWorld(world, 2);
        const position = handle.rigidBody.translation();

        expect(position.x).toBeLessThanOrEqual(0.6);
    });

    it('steps up small ledges but not taller ones', () => {
        const world = createWorld();
        createGround(world);
        createStep(world, 0.2, { x: 0.6, y: 0.1, z: 0 });
        createStep(world, 0.6, { x: 2.0, y: 0.3, z: 0 });

        const handle = createCharacterController(rapier, world, DEFAULT_PLAYER_CONFIG, { x: 0, y: 1.2, z: 0 });
        settleOnGround(world, handle);

        for (let i = 0; i < 6; i++) {
            world.step();
            moveCharacter(handle, { x: 0.2, y: 0, z: 0 });
            stepWorld(world, 1);
        }
        const afterSmallStep = handle.rigidBody.translation();

        for (let i = 0; i < 10; i++) {
            world.step();
            moveCharacter(handle, { x: 0.2, y: 0, z: 0 });
            stepWorld(world, 1);
        }
        const afterTallStep = handle.rigidBody.translation();

        expect(afterSmallStep.x).toBeGreaterThan(0.6);
        expect(afterSmallStep.y).toBeGreaterThan(getCapsuleRestHeight() + 0.05);
        expect(afterTallStep.x).toBeLessThanOrEqual(1.6);
    });
});
