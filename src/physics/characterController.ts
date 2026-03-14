import type * as Rapier from '@dimforge/rapier3d-compat';

import { PLAYER_GROUP } from './collisionLayers';

export type CharacterControllerConfig = {
    autoStepMaxHeight: number;
    autoStepMinWidth: number;
    height: number;
    maxSlopeAngleDeg: number;
    radius: number;
    snapToGroundDistance: number;
};

export const DEFAULT_PLAYER_CONFIG: CharacterControllerConfig = {
    autoStepMaxHeight: 0.3,
    autoStepMinWidth: 0.2,
    height: 1.8,
    maxSlopeAngleDeg: 45,
    radius: 0.3,
    snapToGroundDistance: 0.1,
};

export type CharacterControllerHandle = {
    collider: Rapier.Collider;
    controller: Rapier.KinematicCharacterController;
    rigidBody: Rapier.RigidBody;
};

type RapierAdapter = {
    ColliderDesc: {
        capsule: (halfHeight: number, radius: number) => Rapier.ColliderDesc;
    };
    RigidBodyDesc: {
        kinematicPositionBased: () => Rapier.RigidBodyDesc;
    };
};

type PhysicsWorld = {
    createCharacterController: (offset: number) => Rapier.KinematicCharacterController;
    createRigidBody: (desc: Rapier.RigidBodyDesc) => Rapier.RigidBody;
    createCollider: (desc: Rapier.ColliderDesc, rigidBody: Rapier.RigidBody) => Rapier.Collider;
};

/**
 * Create a Rapier KinematicCharacterController with a capsule collider.
 *
 * The controller handles slope climbing, auto-stepping, ground snapping,
 * and wall sliding automatically via `computeColliderMovement`.
 */
export const createCharacterController = (
    rapier: RapierAdapter,
    world: PhysicsWorld,
    config: CharacterControllerConfig,
    startPosition: { x: number; y: number; z: number },
): CharacterControllerHandle => {
    const halfHeight = config.height / 2 - config.radius;
    if (!Number.isFinite(config.height) || !Number.isFinite(config.radius) || config.radius <= 0 || halfHeight <= 0) {
        throw new Error(`Invalid character controller dimensions: height=${config.height}, radius=${config.radius}`);
    }

    const controller = world.createCharacterController(0.01);
    const slopeRadians = (config.maxSlopeAngleDeg * Math.PI) / 180;
    controller.setMaxSlopeClimbAngle(slopeRadians);
    controller.setMinSlopeSlideAngle(slopeRadians);
    controller.enableAutostep(config.autoStepMaxHeight, config.autoStepMinWidth, true);
    controller.enableSnapToGround(config.snapToGroundDistance);
    controller.setApplyImpulsesToDynamicBodies(true);

    const rigidBodyDesc = rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        startPosition.x,
        startPosition.y,
        startPosition.z,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = rapier.ColliderDesc.capsule(halfHeight, config.radius).setCollisionGroups(PLAYER_GROUP);
    const collider = world.createCollider(colliderDesc, rigidBody);

    return { collider, controller, rigidBody };
};

/**
 * Move the character using the kinematic controller.
 *
 * Computes collider movement against the world geometry, applies
 * the corrected translation, and returns whether the character is grounded.
 */
export const moveCharacter = (
    handle: CharacterControllerHandle,
    desiredTranslation: { x: number; y: number; z: number },
): boolean => {
    handle.controller.computeColliderMovement(handle.collider, desiredTranslation);
    const corrected = handle.controller.computedMovement();
    const currentPos = handle.rigidBody.translation();
    handle.rigidBody.setNextKinematicTranslation({
        x: currentPos.x + corrected.x,
        y: currentPos.y + corrected.y,
        z: currentPos.z + corrected.z,
    });
    return handle.controller.computedGrounded();
};
