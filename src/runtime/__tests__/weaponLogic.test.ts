import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { CharacterControllerHandle } from '../../physics/characterController';
import type { FpsCamera } from '../../render/scene';
import type { PhysicsSystem } from '../physics';
import { PlayerController } from '../player';
import type { InputState } from '../types';
import { WeaponId } from '../types';
import { WeaponRegistry } from '../weapons';

type PhysicsStub = Pick<
    PhysicsSystem,
    'canPlayerStandUp' | 'createKinematicPlayer' | 'moveKinematicPlayer' | 'raycastWithNormal' | 'resizePlayerCapsule'
>;

const createPhysicsStub = (): PhysicsStub => {
    const rigidBody = {
        setTranslation: () => {},
        translation: () => ({ x: 0, y: 1, z: 0 }),
    } as unknown as CharacterControllerHandle['rigidBody'];

    const handle: CharacterControllerHandle = {
        collider: {} as CharacterControllerHandle['collider'],
        controller: {} as CharacterControllerHandle['controller'],
        rigidBody,
    };

    return {
        canPlayerStandUp: () => true,
        createKinematicPlayer: () => handle,
        moveKinematicPlayer: () => true,
        raycastWithNormal: () => null,
        resizePlayerCapsule: () => {},
    };
};

const createInputState = (): InputState => ({
    backward: false,
    crouch: false,
    deltaTime: 1 / 60,
    forward: false,
    jump: false,
    left: false,
    lookingRotationQuat: new THREE.Quaternion(),
    reload: false,
    right: false,
    shoot: true,
    sprint: false,
    switchToKnife: false,
    switchToPrimary: false,
    switchToSecondary: false,
});

describe('Weapon logic', () => {
    it('allows knife attacks without ammo', () => {
        WeaponRegistry.initializeWeaponDefinitions();

        const physics = createPhysicsStub();
        const camera = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
        } as unknown as FpsCamera;

        const player = new PlayerController(physics as PhysicsSystem, camera, new THREE.Vector3());
        player.debugSetWeapon(WeaponId.KNIFE);

        const input = createInputState();

        const first = player.processInput(input, 300);
        expect(first.hasShoot).toBe(true);

        const second = player.processInput(input, 700);
        expect(second.hasShoot).toBe(true);

        const state = player.getCurrentWeaponState();
        expect(state?.currentAmmo).toBe(0);
    });
});
