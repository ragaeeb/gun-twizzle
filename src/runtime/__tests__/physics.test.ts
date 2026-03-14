import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PLAYER_CONFIG } from '../../physics/characterController';
import { WORLD_GROUP } from '../../physics/collisionLayers';
import { PhysicsSystem } from '../physics';

type FakeRigidBodyDesc = {
    setCcdEnabled: () => FakeRigidBodyDesc;
    setTranslation: (x: number, y: number, z: number) => FakeRigidBodyDesc;
    lockRotations: () => FakeRigidBodyDesc;
};

type FakeColliderDesc = {
    setFriction: () => FakeColliderDesc;
    setRestitution: () => FakeColliderDesc;
    setCollisionGroups: (groups: number) => FakeColliderDesc;
};

const createRapierStub = (overrides?: {
    capsule?: (halfHeight: number, radius: number) => FakeColliderDesc;
    trimesh?: (vertices: Float32Array, indices: Uint32Array) => FakeColliderDesc;
}) => {
    const defaultColliderDesc: FakeColliderDesc = {
        setCollisionGroups: () => defaultColliderDesc,
        setFriction: () => defaultColliderDesc,
        setRestitution: () => defaultColliderDesc,
    };

    const colliderDesc = {
        capsule: overrides?.capsule ?? (() => defaultColliderDesc),
        trimesh:
            overrides?.trimesh ??
            (() =>
                ({
                    setCollisionGroups: () => defaultColliderDesc,
                    setFriction: () => defaultColliderDesc,
                    setRestitution: () => defaultColliderDesc,
                }) as FakeColliderDesc),
    };

    const rigidBodyDescFactory = (): FakeRigidBodyDesc => ({
        lockRotations: () => rigidBodyDescFactory(),
        setCcdEnabled: () => rigidBodyDescFactory(),
        setTranslation: () => rigidBodyDescFactory(),
    });

    return {
        ColliderDesc: colliderDesc,
        RigidBodyDesc: {
            dynamic: () => rigidBodyDescFactory(),
            fixed: () => rigidBodyDescFactory(),
        },
    };
};

describe('PhysicsSystem', () => {
    it('computes capsule half-height as height / 2 - radius', () => {
        let recordedHalfHeight = 0;
        let recordedRadius = 0;
        const stubColliderDesc: FakeColliderDesc = {
            setCollisionGroups: () => stubColliderDesc,
            setFriction: () => stubColliderDesc,
            setRestitution: () => stubColliderDesc,
        };
        const rapier = createRapierStub({
            capsule: (halfHeight, radius) => {
                recordedHalfHeight = halfHeight;
                recordedRadius = radius;
                return stubColliderDesc;
            },
        });

        const world = {
            createCollider: vi.fn(),
            createRigidBody: () => ({ handle: 1 }),
        };

        const physics = new PhysicsSystem();
        physics.setWorld(rapier, world);

        const height = 2.0;
        const radius = 0.4;
        const body = physics.createPlayerBody(height, radius, new THREE.Vector3(0, 0, 0));

        expect(body).not.toBeNull();
        expect(recordedHalfHeight).toBeCloseTo(height / 2 - radius);
        expect(recordedRadius).toBe(radius);
    });

    it('skips capsule resize when new height is invalid', () => {
        const physics = new PhysicsSystem();
        const handle = {
            collider: { setHalfHeight: vi.fn() },
        } as unknown as Parameters<PhysicsSystem['resizePlayerCapsule']>[0];

        physics.resizePlayerCapsule(handle, DEFAULT_PLAYER_CONFIG.radius * 2 - 0.1);

        expect(handle.collider.setHalfHeight).not.toHaveBeenCalled();
    });

    it('builds trimesh vertices relative to rigid body origin', async () => {
        let recordedVertices: Float32Array | null = null;
        const trimeshDesc: FakeColliderDesc = {
            setCollisionGroups: () => trimeshDesc,
            setFriction: () => trimeshDesc,
            setRestitution: () => trimeshDesc,
        };
        const rapier = createRapierStub({
            trimesh: (vertices) => {
                recordedVertices = vertices;
                return trimeshDesc;
            },
        });

        const world = {
            createCollider: vi.fn(),
            createRigidBody: () => ({ handle: 1 }),
        };

        const physics = new PhysicsSystem();
        physics.setWorld(rapier, world);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
        geometry.setIndex([0, 1, 2]);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        const root = new THREE.Group();
        root.add(mesh);

        const position = new THREE.Vector3(5, 0, 0);
        root.position.copy(position);

        await physics.createTrimeshCollider(root, position);

        expect(recordedVertices).not.toBeNull();
        expect(Array.from(recordedVertices ?? [])).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    });

    it('assigns WORLD_GROUP to fixed colliders', () => {
        const setCollisionGroups = vi.fn();
        const cuboidDesc: FakeColliderDesc = {
            setCollisionGroups: (groups) => {
                setCollisionGroups(groups);
                return cuboidDesc;
            },
            setFriction: () => cuboidDesc,
            setRestitution: () => cuboidDesc,
        };
        const rigidBodyDesc = {
            setTranslation: () => rigidBodyDesc,
        };
        const rapier = {
            ColliderDesc: {
                cuboid: () => cuboidDesc,
            },
            RigidBodyDesc: {
                fixed: () => rigidBodyDesc,
            },
        };

        const world = {
            createCollider: vi.fn(),
            createRigidBody: () => ({ handle: 1 }),
        };

        const physics = new PhysicsSystem();
        physics.setWorld(rapier, world);

        physics.createGround(10, 10);

        expect(setCollisionGroups).toHaveBeenCalledWith(WORLD_GROUP);
    });
});
