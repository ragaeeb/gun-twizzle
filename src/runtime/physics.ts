import type * as Rapier from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { AssetManager } from '../assets/gameAssets';
import {
    type CharacterControllerHandle,
    createCharacterController,
    DEFAULT_PLAYER_CONFIG,
    moveCharacter,
} from '../physics/characterController';
import { PLAYER_GROUP, WORLD_GROUP } from '../physics/collisionLayers';

// Two copies of rapier exist at runtime (@react-three/rapier bundles its own).
// We use a loose type alias for the module to accept either copy.
// biome-ignore lint/suspicious/noExplicitAny: dual-package rapier type workaround
type RapierModule = any;
type RapierWorld = Rapier.World;
type RapierRigidBody = Rapier.RigidBody;

export class PhysicsSystem {
    private world: RapierWorld | null = null;
    private rapier: RapierModule | null = null;
    private bodies = new Map<number, RapierRigidBody>();
    private meshMap = new Map<number, THREE.Object3D>();

    // biome-ignore lint/suspicious/noExplicitAny: accepts World from either @dimforge/rapier3d-compat copy
    setWorld(rapier: RapierModule, world: any) {
        this.rapier = rapier;
        this.world = world;
    }

    isReady() {
        return Boolean(this.world && this.rapier);
    }

    createGround(width: number, depth: number) {
        if (!this.world || !this.rapier) {
            return null;
        }

        const rigidBodyDesc = this.rapier.RigidBodyDesc.fixed();
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);
        const colliderDesc = this.rapier.ColliderDesc.cuboid(width / 2, 0.1, depth / 2);
        colliderDesc.setCollisionGroups(WORLD_GROUP);
        this.world.createCollider(colliderDesc, rigidBody);
        return rigidBody;
    }

    createBox(width: number, height: number, depth: number, position: THREE.Vector3, isFixed = false) {
        if (!this.world || !this.rapier) {
            return null;
        }

        const rigidBodyDesc = isFixed ? this.rapier.RigidBodyDesc.fixed() : this.rapier.RigidBodyDesc.dynamic();

        rigidBodyDesc.setTranslation(position.x, position.y, position.z);

        const rigidBody = this.world.createRigidBody(rigidBodyDesc);
        const colliderDesc = this.rapier.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
        colliderDesc.setFriction(1);
        if (isFixed) {
            colliderDesc.setCollisionGroups(WORLD_GROUP);
        }
        this.world.createCollider(colliderDesc, rigidBody);

        return rigidBody;
    }

    createPlayerBody(height: number, radius: number, position: THREE.Vector3) {
        if (!this.world || !this.rapier) {
            return null;
        }

        const halfHeight = height / 2 - radius;
        if (halfHeight <= 0) {
            console.warn('createPlayerBody: height must be greater than 2 * radius');
            return null;
        }

        const rigidBodyDesc = this.rapier.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setCcdEnabled(true)
            .lockRotations();

        const rigidBody = this.world.createRigidBody(rigidBodyDesc);
        const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, radius)
            .setFriction(0)
            .setRestitution(0)
            .setCollisionGroups(PLAYER_GROUP);

        this.world.createCollider(colliderDesc, rigidBody);
        return rigidBody;
    }

    addMesh(mesh: THREE.Object3D, rigidBody: RapierRigidBody) {
        const handle = rigidBody.handle;
        this.bodies.set(handle, rigidBody);
        this.meshMap.set(handle, mesh);
    }

    syncMeshes() {
        if (!this.world) {
            return;
        }

        for (const [handle, rigidBody] of this.bodies.entries()) {
            const mesh = this.meshMap.get(handle);
            if (!mesh) {
                continue;
            }

            const position = rigidBody.translation();
            mesh.position.set(position.x, position.y, position.z);

            const rotation = rigidBody.rotation();
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    }

    applyImpulse(rigidBody: RapierRigidBody, impulse: THREE.Vector3) {
        rigidBody.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }

    setLinearVelocity(rigidBody: RapierRigidBody, velocity: THREE.Vector3) {
        rigidBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    }

    raycast(
        origin: THREE.Vector3,
        direction: THREE.Vector3,
        maxDistance: number,
        excludedRigidBody: RapierRigidBody,
        solid = true,
    ) {
        if (!this.world || !this.rapier) {
            return null;
        }

        const ray = new this.rapier.Ray(
            { x: origin.x, y: origin.y, z: origin.z },
            { x: direction.x, y: direction.y, z: direction.z },
        );

        return this.world.castRay(ray, maxDistance, solid, undefined, undefined, undefined, excludedRigidBody);
    }

    raycastWithNormal(
        origin: THREE.Vector3,
        direction: THREE.Vector3,
        maxDistance: number,
        excludedRigidBody: RapierRigidBody,
        solid = true,
    ) {
        if (!this.world || !this.rapier) {
            return null;
        }

        const ray = new this.rapier.Ray(
            { x: origin.x, y: origin.y, z: origin.z },
            { x: direction.x, y: direction.y, z: direction.z },
        );

        return this.world.castRayAndGetNormal(
            ray,
            maxDistance,
            solid,
            undefined,
            undefined,
            undefined,
            excludedRigidBody,
        );
    }

    async createTrimeshCollider(
        root: THREE.Object3D,
        position: THREE.Vector3,
        scale = new THREE.Vector3(1, 1, 1),
        isFixed = true,
    ) {
        if (!this.world || !this.rapier) {
            return null;
        }

        let rigidBody: RapierRigidBody | null = null;
        try {
            root.scale.copy(scale);
            root.updateMatrixWorld(true);

            const rigidBodyDesc = isFixed ? this.rapier.RigidBodyDesc.fixed() : this.rapier.RigidBodyDesc.dynamic();
            rigidBodyDesc.setTranslation(position.x, position.y, position.z);
            const bodyOrigin = new THREE.Vector3(position.x, position.y, position.z);

            rigidBody = this.world.createRigidBody(rigidBodyDesc);
            const meshes = AssetManager.extractMeshes(root);

            for (const mesh of meshes) {
                const geometry = mesh.geometry;
                if (!geometry.attributes.position || !geometry.index) {
                    continue;
                }

                const positions = geometry.attributes.position;
                const indices = geometry.index;
                const vertices = new Float32Array(positions.count * 3);
                const triangleIndices = new Uint32Array(indices.count);
                const vertex = new THREE.Vector3();

                for (let index = 0; index < positions.count; index += 1) {
                    vertex.fromBufferAttribute(positions, index);
                    mesh.localToWorld(vertex);
                    vertex.sub(bodyOrigin);
                    vertices[index * 3] = vertex.x;
                    vertices[index * 3 + 1] = vertex.y;
                    vertices[index * 3 + 2] = vertex.z;
                }

                for (let index = 0; index < indices.count; index += 1) {
                    triangleIndices[index] = indices.getX(index);
                }

                const colliderDesc = this.rapier.ColliderDesc.trimesh(vertices, triangleIndices);
                colliderDesc.setFriction(0);
                if (isFixed) {
                    colliderDesc.setCollisionGroups(WORLD_GROUP);
                }
                this.world.createCollider(colliderDesc, rigidBody);
            }

            this.addMesh(root, rigidBody);
            return rigidBody;
        } catch (error) {
            if (rigidBody) {
                this.world.removeRigidBody(rigidBody);
            }
            console.error('Failed to create trimesh collider', error);
            return null;
        }
    }

    createKinematicPlayer(startPosition: { x: number; y: number; z: number }): CharacterControllerHandle | null {
        if (!this.world || !this.rapier) {
            return null;
        }

        return createCharacterController(this.rapier, this.world, DEFAULT_PLAYER_CONFIG, startPosition);
    }

    moveKinematicPlayer(
        handle: CharacterControllerHandle,
        desiredTranslation: { x: number; y: number; z: number },
    ): boolean {
        return moveCharacter(handle, desiredTranslation);
    }

    resizePlayerCapsule(handle: CharacterControllerHandle, newHeight: number): void {
        const radius = DEFAULT_PLAYER_CONFIG.radius;
        const newHalfHeight = newHeight / 2 - radius;
        if (newHalfHeight <= 0) {
            return;
        }

        try {
            // biome-ignore lint/suspicious/noExplicitAny: setHalfHeight exists on capsule colliders but may not be in TS defs
            (handle.collider as any).setHalfHeight(newHalfHeight);
        } catch {
            if (!this.world || !this.rapier) {
                return;
            }
            this.world.removeCollider(handle.collider, false);
            const colliderDesc = this.rapier.ColliderDesc.capsule(newHalfHeight, radius).setCollisionGroups(
                PLAYER_GROUP,
            );
            handle.collider = this.world.createCollider(colliderDesc, handle.rigidBody);
        }
    }

    canPlayerStandUp(handle: CharacterControllerHandle, crouchHeight: number, standHeight: number): boolean {
        if (!this.world || !this.rapier) {
            return false;
        }

        const pos = handle.rigidBody.translation();
        const topOfCrouching = pos.y + crouchHeight / 2;
        const clearanceNeeded = standHeight - crouchHeight;

        const ray = new this.rapier.Ray({ x: pos.x, y: topOfCrouching, z: pos.z }, { x: 0, y: 1, z: 0 });

        const hit = this.world.castRay(ray, clearanceNeeded, true, undefined, undefined, undefined, handle.rigidBody);

        return !hit;
    }
}
