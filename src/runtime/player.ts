import * as THREE from 'three';

import { AssetManager, AudioManager } from '../assets/gameAssets';
import { ShootParticleSystem } from '../render/effects';
import type { FpsCamera, GameScene } from '../render/scene';
import type { PhysicsSystem } from './physics';
import type { HitResult, InputState, WeaponDefinition, WeaponId as WeaponIdType } from './types';
import { WeaponAnimation, WeaponId } from './types';
import { WeaponRegistry } from './weapons';

// ─── Shared types ──────────────────────────────────────────────────────

type WeaponProcessResult = {
    hasReload: boolean;
    hasShoot: boolean;
    hasSwitchToKnife: boolean;
    hasSwitchToPrimary: boolean;
    hasSwitchToSecondary: boolean;
    hitScanResult?: HitResult | null;
    weaponId: WeaponIdType;
    weaponState: WeaponStateData | null;
};

type WeaponStateData = {
    currentAmmo: number;
    definition: WeaponDefinition;
    isAiming: boolean;
    isReloading: boolean;
    lastFireTime: number;
    reloadStartTime: number;
    totalAmmo: number;
    weaponId: WeaponIdType;
};

// ─── WeaponShooter ─────────────────────────────────────────────────────

class WeaponShooter {
    private physicsSystem: PhysicsSystem;

    constructor(physicsSystem: PhysicsSystem) {
        this.physicsSystem = physicsSystem;
    }

    shoot(
        player: PlayerController,
        playerPosition: THREE.Vector3,
        lookingRotation: THREE.Quaternion,
        weaponDefinition: WeaponDefinition,
    ): HitResult | null {
        const origin = new THREE.Vector3(playerPosition.x, playerPosition.y + player.eyeOffset, playerPosition.z);
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(lookingRotation);
        direction.normalize();

        const range = weaponDefinition.stats.range || 1000;
        const rigidBody = player.getRigidBody();

        if (!rigidBody) {
            throw new Error('WeaponShooter: Player rigid body not found, cannot perform raycast.');
        }

        const result = this.physicsSystem.raycastWithNormal(origin, direction, range, rigidBody, true);

        if (!result) {
            return null;
        }

        return {
            distance: result.timeOfImpact,
            hit: true,
            hitCollider: result.collider,
            hitNormal: new THREE.Vector3(result.normal.x, result.normal.y, result.normal.z),
            hitPoint: origin.clone().add(direction.clone().multiplyScalar(result.timeOfImpact)),
            rawHit: result,
        };
    }
}

// ─── WeaponState ───────────────────────────────────────────────────────

const createWeaponState = (weaponId: WeaponIdType, definition: WeaponDefinition): WeaponStateData => ({
    currentAmmo: definition.stats.magazineSize,
    definition,
    isAiming: false,
    isReloading: false,
    lastFireTime: 0,
    reloadStartTime: 0,
    totalAmmo: definition.stats.totalAmmo,
    weaponId,
});

const cloneWeaponState = (state: WeaponStateData): WeaponStateData => ({ ...state });

// ─── WeaponLogicSystem ─────────────────────────────────────────────────

class WeaponLogicSystem {
    private currentWeaponId: WeaponIdType = WeaponId.USP;
    private weaponStates = new Map<WeaponIdType, WeaponStateData>();
    private lastWeaponSwitchTime = 0;
    private readonly weaponSwitchCooldown = 400;
    private weaponShooter: WeaponShooter;

    constructor(physicsSystem: PhysicsSystem) {
        this.weaponShooter = new WeaponShooter(physicsSystem);
        this.initializeWeaponStates();
    }

    private initializeWeaponStates() {
        for (const weaponId of WeaponRegistry.getAllIds()) {
            const definition = WeaponRegistry.get(weaponId);
            if (definition) {
                this.weaponStates.set(weaponId, createWeaponState(weaponId, definition));
            }
        }
    }

    processInput(input: InputState, player: PlayerController, nowMs: number): WeaponProcessResult {
        const state = this.getCurrentWeaponState();
        const definition = WeaponRegistry.get(this.currentWeaponId);

        if (!state || !definition) {
            return this.createEmptyResult();
        }

        const result: WeaponProcessResult = {
            hasReload: false,
            hasShoot: false,
            hasSwitchToKnife: false,
            hasSwitchToPrimary: false,
            hasSwitchToSecondary: false,
            weaponId: this.currentWeaponId,
            weaponState: cloneWeaponState(state),
        };

        this.processReloadTimer(state, definition, nowMs);
        this.processShootAndReload(input, state, definition, nowMs, player, result);
        this.processWeaponSwitch(input, nowMs, result);

        result.weaponState = cloneWeaponState(state);
        return result;
    }

    private processReloadTimer(state: WeaponStateData, definition: WeaponDefinition, now: number) {
        if (!state.isReloading) {
            return;
        }
        const reloadDuration = definition.stats.reloadTime * 1000;
        if (now - state.reloadStartTime >= reloadDuration) {
            this.finishReload(state, definition);
        }
    }

    private processShootAndReload(
        input: InputState,
        state: WeaponStateData,
        definition: WeaponDefinition,
        now: number,
        player: PlayerController,
        result: WeaponProcessResult,
    ) {
        if (input.shoot && this.canShoot(state, definition, now)) {
            result.hasShoot = true;
            result.hitScanResult = this.shoot(state, now, player, input.lookingRotationQuat);
        }

        const isMagazineEmpty = state.currentAmmo <= 0;
        if ((input.reload || isMagazineEmpty) && this.canReload(state)) {
            result.hasReload = true;
            this.startReload(state, now);
        }
    }

    private processWeaponSwitch(input: InputState, now: number, result: WeaponProcessResult) {
        if (!this.canSwitchWeapon(now)) {
            return;
        }

        if (input.switchToPrimary && this.currentWeaponId !== WeaponId.AK47) {
            result.hasSwitchToPrimary = true;
            this.switchWeapon(WeaponId.AK47, now);
        } else if (input.switchToSecondary && this.currentWeaponId !== WeaponId.USP) {
            result.hasSwitchToSecondary = true;
            this.switchWeapon(WeaponId.USP, now);
        } else if (input.switchToKnife && this.currentWeaponId !== WeaponId.KNIFE) {
            result.hasSwitchToKnife = true;
            this.switchWeapon(WeaponId.KNIFE, now);
        }
    }

    private canShoot(state: WeaponStateData, definition: WeaponDefinition, now: number): boolean {
        if (state.isReloading || state.currentAmmo <= 0) {
            return false;
        }

        const msPerShot = 60000 / definition.stats.fireRate;
        return now - state.lastFireTime >= msPerShot;
    }

    private shoot(
        state: WeaponStateData,
        now: number,
        player: PlayerController,
        lookingRotation: THREE.Quaternion,
    ): HitResult | null {
        state.currentAmmo -= 1;
        state.lastFireTime = now;

        const playerPosition = player.getPosition();
        const hitScanResult = this.weaponShooter.shoot(player, playerPosition, lookingRotation, state.definition);

        if (hitScanResult) {
            this.applyImpactForce(hitScanResult, state.definition, playerPosition);
        }

        return hitScanResult;
    }

    private applyImpactForce(hitScanResult: HitResult, definition: WeaponDefinition, playerPosition: THREE.Vector3) {
        // biome-ignore lint/suspicious/noExplicitAny: Rapier collider from dual-package
        const collider = hitScanResult.hitCollider as any;
        const rigidBody = collider?.parent?.();
        if (!rigidBody?.isDynamic() || !hitScanResult.hitPoint) {
            return;
        }

        const impulse = hitScanResult.hitPoint
            .clone()
            .sub(playerPosition)
            .normalize()
            .multiplyScalar(definition.stats.damage);

        rigidBody.applyImpulseAtPoint(
            { x: impulse.x, y: impulse.y, z: impulse.z },
            { x: hitScanResult.hitPoint.x, y: hitScanResult.hitPoint.y, z: hitScanResult.hitPoint.z },
            true,
        );
    }

    private canReload(state: WeaponStateData): boolean {
        if (state.isReloading || state.totalAmmo <= 0) {
            return false;
        }
        const definition = WeaponRegistry.get(state.weaponId);
        return Boolean(definition) && state.currentAmmo < (definition?.stats.magazineSize ?? 0);
    }

    private startReload(state: WeaponStateData, now: number) {
        state.isReloading = true;
        state.reloadStartTime = now;
    }

    private finishReload(state: WeaponStateData, definition: WeaponDefinition) {
        const ammoNeeded = definition.stats.magazineSize - state.currentAmmo;
        const ammoToLoad = Math.min(ammoNeeded, state.totalAmmo);
        state.currentAmmo += ammoToLoad;
        state.totalAmmo -= ammoToLoad;
        state.isReloading = false;
        state.reloadStartTime = 0;
    }

    addAmmo(weaponId: WeaponIdType, amount: number) {
        const state = this.weaponStates.get(weaponId);
        if (state) {
            state.totalAmmo += amount;
        }
    }

    debugSetWeapon(weaponId: WeaponIdType) {
        if (!WeaponRegistry.exists(weaponId)) {
            return;
        }
        this.currentWeaponId = weaponId;
        this.lastWeaponSwitchTime = 0;
    }

    private canSwitchWeapon(now: number): boolean {
        return now - this.lastWeaponSwitchTime >= this.weaponSwitchCooldown;
    }

    private switchWeapon(nextWeaponId: WeaponIdType, now: number) {
        const currentState = this.getCurrentWeaponState();
        if (currentState) {
            currentState.isReloading = false;
        }
        if (WeaponRegistry.exists(nextWeaponId)) {
            this.currentWeaponId = nextWeaponId;
            this.lastWeaponSwitchTime = now;
        }
    }

    getCurrentWeaponState(): WeaponStateData | undefined {
        return this.weaponStates.get(this.currentWeaponId);
    }

    getCurrentWeaponDefinition(): WeaponDefinition | undefined {
        return WeaponRegistry.get(this.currentWeaponId);
    }

    getCurrentWeaponId(): WeaponIdType {
        return this.currentWeaponId;
    }

    private createEmptyResult(): WeaponProcessResult {
        const definition = WeaponRegistry.get(this.currentWeaponId);
        return {
            hasReload: false,
            hasShoot: false,
            hasSwitchToKnife: false,
            hasSwitchToPrimary: false,
            hasSwitchToSecondary: false,
            weaponId: this.currentWeaponId,
            weaponState: definition ? createWeaponState(this.currentWeaponId, definition) : null,
        };
    }
}

// ─── Stance ─────────────────────────────────────────────────────────────

type PlayerStance = 'standing' | 'crouching' | 'sliding';

// ─── PlayerController ──────────────────────────────────────────────────

export class PlayerController {
    static STANDING_EYE_OFFSET = 1.5;
    static CROUCH_EYE_OFFSET = 0.8;
    static STANDING_HEIGHT = 1.8;
    static CROUCH_HEIGHT = 1.0;

    private static SLIDE_DURATION = 1.5;
    private static CROUCH_SPEED_MULT = 0.5;
    private static EYE_LERP_SPEED = 12;

    private physics: PhysicsSystem;
    private camera: FpsCamera;
    // biome-ignore lint/suspicious/noExplicitAny: CharacterControllerHandle from dual-package rapier
    private characterHandle: any;
    private currentVelocity = new THREE.Vector3();
    private verticalVelocity = 0;
    private grounded = false;
    private readonly maxSpeed = 12;
    private readonly sprintMultiplier = 1.5;
    private readonly acceleration = 14;
    private readonly airAcceleration = 12;
    private readonly friction = 10;
    private readonly stopSpeed = 4.5;
    private readonly airMaxSpeed = 4.8;
    private readonly jumpForce = 15;
    private readonly gravity = -30;
    private weaponLogicSystem: WeaponLogicSystem;
    private _isSprinting = false;
    private _stance: PlayerStance = 'standing';
    private _slideTimer = 0;
    private _slideDirection = new THREE.Vector3();
    private _slideSpeed = 0;
    private _currentEyeOffset = PlayerController.STANDING_EYE_OFFSET;
    private _currentCapsuleHeight = PlayerController.STANDING_HEIGHT;

    constructor(physicsSystem: PhysicsSystem, camera: FpsCamera, spawnPosition = new THREE.Vector3(0, 5, 5)) {
        this.physics = physicsSystem;
        this.camera = camera;
        this.characterHandle = this.physics.createKinematicPlayer({
            x: spawnPosition.x,
            y: spawnPosition.y,
            z: spawnPosition.z,
        });
        this.weaponLogicSystem = new WeaponLogicSystem(physicsSystem);
        this.updateCameraPosition();
    }

    processInput(input: InputState, nowMs: number): WeaponProcessResult {
        this.processMovementInput(input);
        return this.weaponLogicSystem.processInput(input, this, nowMs);
    }

    private processMovementInput(input: InputState) {
        if (!this.characterHandle) {
            return;
        }

        const dt = input.deltaTime;

        this._isSprinting =
            this._stance === 'standing' &&
            input.sprint &&
            this.grounded &&
            (input.forward || input.backward || input.left || input.right);

        this.updateStance(input, dt);

        if (this._stance !== 'standing') {
            this._isSprinting = false;
        }

        const jumpedThisFrame = this.processJump(input);
        this.processGroundPhysics(dt, jumpedThisFrame);
        this.processHorizontalMovement(input, dt);

        this.verticalVelocity += this.gravity * dt;
        if (this.grounded && !jumpedThisFrame && this.verticalVelocity < 0) {
            this.verticalVelocity = -0.1;
        }

        this.grounded = this.physics.moveKinematicPlayer(this.characterHandle, {
            x: this.currentVelocity.x * dt,
            y: this.verticalVelocity * dt,
            z: this.currentVelocity.z * dt,
        });

        this.lerpEyeOffset(dt);
        this.updateCameraPosition();
    }

    private processJump(input: InputState): boolean {
        if (!input.jump || !this.grounded || this._stance === 'sliding') {
            return false;
        }
        this.verticalVelocity = this.jumpForce;
        if (this._stance === 'crouching') {
            this.tryStandUp();
        }
        return true;
    }

    private processGroundPhysics(dt: number, jumpedThisFrame: boolean) {
        if (!this.grounded || jumpedThisFrame) {
            return;
        }
        this.verticalVelocity = 0;
        if (this._stance !== 'sliding') {
            this.applyFriction(dt);
        }
    }

    private processHorizontalMovement(input: InputState, dt: number) {
        if (this._stance === 'sliding') {
            this.updateSlideVelocity(dt);
        } else {
            const wishDirection = this.getWishDirection(input);
            this.accelerate(dt, wishDirection, this.grounded);
        }
    }

    private lerpEyeOffset(dt: number) {
        const target =
            this._stance === 'standing' ? PlayerController.STANDING_EYE_OFFSET : PlayerController.CROUCH_EYE_OFFSET;
        this._currentEyeOffset += (target - this._currentEyeOffset) * Math.min(PlayerController.EYE_LERP_SPEED * dt, 1);
    }

    get isSprinting(): boolean {
        return this._isSprinting;
    }

    get stance(): PlayerStance {
        return this._stance;
    }

    get eyeOffset(): number {
        return this._currentEyeOffset;
    }

    // ─── Stance helpers ─────────────────────────────────────────────────

    private updateStance(input: InputState, dt: number) {
        switch (this._stance) {
            case 'standing':
                if (input.crouch) {
                    if (this._isSprinting && this.grounded) {
                        this.startSlide();
                    } else {
                        this.startCrouch();
                    }
                }
                break;

            case 'sliding':
                this._slideTimer -= dt;
                if (this._slideTimer <= 0) {
                    if (input.crouch || !this.tryStandUp()) {
                        this._stance = 'crouching';
                    }
                }
                break;

            case 'crouching':
                if (!input.crouch) {
                    this.tryStandUp();
                }
                break;
        }
    }

    private startCrouch() {
        this._stance = 'crouching';
        this.resizeCapsule(PlayerController.CROUCH_HEIGHT);
    }

    private startSlide() {
        this._stance = 'sliding';
        this._slideTimer = PlayerController.SLIDE_DURATION;

        const speed = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
        if (speed > 0.1) {
            this._slideDirection.set(this.currentVelocity.x / speed, 0, this.currentVelocity.z / speed);
            this._slideSpeed = speed;
        } else {
            const camDir = new THREE.Vector3(0, 0, -1);
            camDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.rotation.y);
            this._slideDirection.copy(camDir);
            this._slideSpeed = this.maxSpeed;
        }

        this.resizeCapsule(PlayerController.CROUCH_HEIGHT);
    }

    private updateSlideVelocity(_dt: number) {
        const progress = 1 - this._slideTimer / PlayerController.SLIDE_DURATION;
        const speedFactor = 1 - progress * progress;
        const speed = this._slideSpeed * speedFactor;

        this.currentVelocity.x = this._slideDirection.x * speed;
        this.currentVelocity.z = this._slideDirection.z * speed;
    }

    private tryStandUp(): boolean {
        if (!this.characterHandle) {
            return false;
        }

        const canStand = this.physics.canPlayerStandUp(
            this.characterHandle,
            PlayerController.CROUCH_HEIGHT,
            PlayerController.STANDING_HEIGHT,
        );

        if (!canStand) {
            return false;
        }

        this._stance = 'standing';
        this.resizeCapsule(PlayerController.STANDING_HEIGHT);
        return true;
    }

    private resizeCapsule(targetHeight: number) {
        if (!this.characterHandle) {
            return;
        }

        const heightDiff = (targetHeight - this._currentCapsuleHeight) / 2;
        this.physics.resizePlayerCapsule(this.characterHandle, targetHeight);

        const pos = this.characterHandle.rigidBody.translation();
        this.characterHandle.rigidBody.setTranslation({ x: pos.x, y: pos.y + heightDiff, z: pos.z }, true);

        this._currentCapsuleHeight = targetHeight;
    }

    private getWishDirection(input: InputState): THREE.Vector3 {
        const direction = new THREE.Vector3();

        if (input.forward) {
            direction.z -= 1;
        }
        if (input.backward) {
            direction.z += 1;
        }
        if (input.left) {
            direction.x -= 1;
        }
        if (input.right) {
            direction.x += 1;
        }

        if (direction.lengthSq() > 0) {
            direction.normalize();
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.rotation.y);
        }

        return direction;
    }

    private accelerate(delta: number, wishDirection: THREE.Vector3, isGrounded: boolean) {
        if (wishDirection.lengthSq() === 0) {
            return;
        }

        let groundMax = this.maxSpeed;
        if (this._isSprinting) {
            groundMax *= this.sprintMultiplier;
        } else if (this._stance === 'crouching') {
            groundMax *= PlayerController.CROUCH_SPEED_MULT;
        }
        const maxSpeed = isGrounded ? groundMax : this.airMaxSpeed;
        const accel = isGrounded ? this.acceleration : this.airAcceleration;
        const currentSpeed = new THREE.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z).dot(wishDirection);
        const remainingSpeed = maxSpeed - currentSpeed;

        if (remainingSpeed <= 0) {
            return;
        }

        const accelerationSpeed = Math.min(accel * maxSpeed * delta, remainingSpeed);
        this.currentVelocity.x += wishDirection.x * accelerationSpeed;
        this.currentVelocity.z += wishDirection.z * accelerationSpeed;

        if (!isGrounded) {
            const horizontalSpeedSq =
                this.currentVelocity.x * this.currentVelocity.x + this.currentVelocity.z * this.currentVelocity.z;

            if (horizontalSpeedSq > 0) {
                const airBoost = Math.min(Math.sqrt(horizontalSpeedSq), 32 * delta);
                this.currentVelocity.x += wishDirection.x * airBoost;
                this.currentVelocity.z += wishDirection.z * airBoost;
            }
        }
    }

    private applyFriction(delta: number) {
        const speed = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
        if (speed < 0.1) {
            this.currentVelocity.x = 0;
            this.currentVelocity.z = 0;
            return;
        }

        const drop = Math.max(speed, this.stopSpeed) * this.friction * delta;
        const nextSpeed = Math.max(0, speed - drop) / speed;

        this.currentVelocity.x *= nextSpeed;
        this.currentVelocity.z *= nextSpeed;
    }

    private updateCameraPosition() {
        if (!this.characterHandle) {
            return;
        }

        const position = this.characterHandle.rigidBody.translation();
        this.camera.position.set(position.x, position.y + this._currentEyeOffset, position.z);
    }

    getPosition(): THREE.Vector3 {
        if (!this.characterHandle) {
            return new THREE.Vector3();
        }

        const position = this.characterHandle.rigidBody.translation();
        return new THREE.Vector3(position.x, position.y, position.z);
    }

    getVelocity(): THREE.Vector3 {
        return new THREE.Vector3(this.currentVelocity.x, this.verticalVelocity, this.currentVelocity.z);
    }

    getCurrentWeaponState(): WeaponStateData | undefined {
        return this.weaponLogicSystem.getCurrentWeaponState();
    }

    getCurrentWeaponDefinition(): WeaponDefinition | undefined {
        return this.weaponLogicSystem.getCurrentWeaponDefinition();
    }

    getCurrentWeaponId(): WeaponIdType {
        return this.weaponLogicSystem.getCurrentWeaponId();
    }

    addAmmo(weaponId: WeaponIdType, amount: number) {
        this.weaponLogicSystem.addAmmo(weaponId, amount);
    }

    debugSetWeapon(weaponId: WeaponIdType) {
        this.weaponLogicSystem.debugSetWeapon(weaponId);
    }

    getRigidBody() {
        return this.characterHandle?.rigidBody ?? null;
    }

    setPosition(position: THREE.Vector3) {
        if (!this.characterHandle) {
            return;
        }
        this.characterHandle.rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
        this.updateCameraPosition();
    }

    setVelocity(velocity: THREE.Vector3) {
        this.currentVelocity.set(velocity.x, 0, velocity.z);
        this.verticalVelocity = velocity.y;
    }
}

// ─── WeaponView ────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: AssetManager is @ts-nocheck, these types will be fixed in M2
type WeaponMeshInstance = any;
type ViewModelDebugTransform = {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
};

class WeaponView {
    private camera: FpsCamera;
    private scene: GameScene;
    private currentWeaponMesh: WeaponMeshInstance | null = null;
    private currentWeaponId: WeaponIdType | null = null;
    private weaponHolder = new THREE.Group();
    // biome-ignore lint/suspicious/noExplicitAny: ShootParticleSystem is @ts-nocheck
    private shootParticle: any;
    private readonly bobSpeed = 10;
    private readonly bobAmount = 0.01;
    private readonly swayAmount = 0.001;
    private targetPosition = new THREE.Vector3();
    private currentPosition = new THREE.Vector3();
    private readonly initialPosition = new THREE.Vector3(0.1, -0.07, 0);
    private readonly jumpingTiltDivisor = 20;
    private readonly jumpingMaxTiltAngle = Math.PI / 16;
    private readonly jumpingMinTiltAngle = -Math.PI / 16;
    private readonly jumpingTiltLerpSpeed = 5;
    private readonly viewmodelFillLight = new THREE.HemisphereLight(0xffffff, 0x3a2418, 2.1);
    private readonly viewmodelKeyLight = new THREE.PointLight(0xfff1d6, 60, 6, 2);

    constructor(camera: FpsCamera, scene: GameScene) {
        this.camera = camera;
        this.scene = scene;

        this.shootParticle = new ShootParticleSystem(this.weaponHolder);
        this.viewmodelFillLight.position.set(0, 1, 0.5);
        this.viewmodelKeyLight.position.set(0.35, 0.15, 0.25);
        this.weaponHolder.add(this.viewmodelFillLight);
        this.weaponHolder.add(this.viewmodelKeyLight);

        this.weaponHolder.position.copy(this.initialPosition);
        this.camera.add(this.weaponHolder);
    }

    private configureWeaponMesh(child: THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) {
                continue;
            }

            material.color.lerp(new THREE.Color(0xd9c4a3), material.map ? 0.12 : 0.55);
            material.emissive.set(0x2b180f);
            material.emissiveIntensity = material.map ? 0.4 : 0.75;
            material.metalness = Math.min(material.metalness, 0.25);
            material.roughness = Math.min(material.roughness, 0.8);
        }
    }

    async setWeapon(weaponId: WeaponIdType) {
        const weaponDef = WeaponRegistry.get(weaponId);
        if (!weaponDef) {
            return;
        }

        if (this.currentWeaponMesh) {
            this.weaponHolder.remove(this.currentWeaponMesh.mesh);
            AssetManager.returnWeaponToPool(this.currentWeaponMesh);
        }

        const weaponMesh = AssetManager.getWeaponInstance(weaponId);
        if (!weaponMesh) {
            return;
        }

        this.currentWeaponMesh = weaponMesh;
        this.currentWeaponId = weaponId;

        if (!this.currentWeaponMesh.mesh) {
            return;
        }

        const pos = weaponDef.modelPosition ?? [0, 0, 0];
        const rot = weaponDef.modelRotation ?? [0, -Math.PI / 2, 0];
        const scale = weaponDef.modelScale ?? 0.05;
        this.currentWeaponMesh.mesh.position.set(pos[0], pos[1], pos[2]);
        this.currentWeaponMesh.mesh.rotation.set(rot[0], rot[1], rot[2]);
        this.currentWeaponMesh.mesh.scale.set(scale, scale, scale);
        this.currentWeaponMesh.mesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
                this.configureWeaponMesh(child);
            }
        });

        this.weaponHolder.add(this.currentWeaponMesh.mesh);
        this.playAnimation(WeaponAnimation.Idle);
    }

    debugSetCurrentTransform(transform: ViewModelDebugTransform) {
        if (!this.currentWeaponMesh?.mesh) {
            return;
        }

        if (transform.position) {
            this.currentWeaponMesh.mesh.position.set(
                transform.position[0],
                transform.position[1],
                transform.position[2],
            );
        }

        if (transform.rotation) {
            this.currentWeaponMesh.mesh.rotation.set(
                transform.rotation[0],
                transform.rotation[1],
                transform.rotation[2],
            );
        }

        if (typeof transform.scale === 'number') {
            this.currentWeaponMesh.mesh.scale.setScalar(transform.scale);
        }
    }

    debugGetCurrentState() {
        if (!this.currentWeaponMesh?.mesh) {
            return null;
        }

        const { position, rotation, scale } = this.currentWeaponMesh.mesh;
        return {
            currentWeaponId: this.currentWeaponId,
            position: [position.x, position.y, position.z] as [number, number, number],
            rotation: [rotation.x, rotation.y, rotation.z] as [number, number, number],
            scale: scale.x,
        };
    }

    debugPlayAnimation(animation: string) {
        this.playAnimation(animation);
    }

    debugGetAnimations() {
        return this.currentWeaponMesh?.getAnimationNames() ?? [];
    }

    debugPoseClip(clipName: string, time = 0) {
        return this.currentWeaponMesh?.debugPoseClip(clipName, time) ?? false;
    }

    update(
        delta: number,
        weaponState: WeaponStateData,
        mouseMovement: { x: number; y: number },
        velocity: THREE.Vector3,
    ) {
        if (!this.currentWeaponMesh) {
            return;
        }

        this.updateVisualEffects(delta, mouseMovement, velocity);
        this.updateAnimations(weaponState);

        this.currentWeaponMesh.update(delta);
        this.shootParticle.update(delta, this.camera);
    }

    playShoot(weaponResult: WeaponProcessResult) {
        this.playAnimation(WeaponAnimation.Shoot);
        this.targetPosition.z += 0.5;
        this.targetPosition.y += 0.05;

        if (!this.currentWeaponId) {
            return;
        }

        const definition = WeaponRegistry.get(this.currentWeaponId);
        if (definition) {
            this.camera.shake(1.4, 400);
        }

        if (definition?.shootSoundKey && this.currentWeaponMesh.isClipBasedAnimation()) {
            AudioManager.playSFX(definition.shootSoundKey, 1, false);
        }

        const particleOffset = definition?.shootParticleOffset;
        if (particleOffset) {
            this.shootParticle.play(new THREE.Vector3(particleOffset.x, particleOffset.y, particleOffset.z));
        }

        if (!weaponResult.hitScanResult) {
            return;
        }

        const { hitPoint, hitNormal, hitCollider } = weaponResult.hitScanResult;
        if (!hitPoint || !hitNormal || !hitCollider) {
            return;
        }

        // biome-ignore lint/suspicious/noExplicitAny: Rapier collider from dual-package
        const collider = hitCollider as any;
        const rigidBody = collider.parent?.();
        if (!rigidBody?.isDynamic()) {
            this.scene.decalSystem?.addBulletHole(hitPoint, hitNormal);
        }

        this.scene.impactParticle?.createImpact(hitPoint, hitNormal, 1);
    }

    playWeaponSwitchAnimation() {
        this.playAnimation(WeaponAnimation.Switch);
    }

    playWeaponReloadAnimation() {
        this.playAnimation(WeaponAnimation.Reload);
    }

    private updateVisualEffects(delta: number, mouseMovement: { x: number; y: number }, velocity: THREE.Vector3) {
        this.targetPosition.copy(this.initialPosition);

        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (horizontalSpeed > 0.1) {
            const normalizedSpeed = Math.min(horizontalSpeed / 6, 1);
            const time = performance.now() / 1000;
            const bobY = Math.sin(time * this.bobSpeed) * this.bobAmount * normalizedSpeed;
            const bobX = Math.cos(time * this.bobSpeed) * (this.bobAmount / 6) * normalizedSpeed;

            this.targetPosition.y += bobY;
            this.targetPosition.x += bobX;
        }

        this.targetPosition.x += mouseMovement.x * this.swayAmount;
        this.targetPosition.y += mouseMovement.y * this.swayAmount;

        this.currentPosition.lerp(this.targetPosition, 10 * delta);
        this.weaponHolder.position.copy(this.currentPosition);

        const tilt = THREE.MathUtils.clamp(
            -velocity.y / this.jumpingTiltDivisor,
            this.jumpingMinTiltAngle,
            this.jumpingMaxTiltAngle,
        );

        this.weaponHolder.rotation.x = THREE.MathUtils.lerp(
            this.weaponHolder.rotation.x,
            tilt,
            delta * this.jumpingTiltLerpSpeed,
        );
    }

    private updateAnimations(weaponState: WeaponStateData) {
        if (this.currentWeaponMesh?.isDebugPoseLocked()) {
            return;
        }

        if (WeaponRegistry.get(weaponState.weaponId) && this.currentWeaponMesh?.isCurrentAnimationFinished()) {
            this.playAnimation(WeaponAnimation.Idle);
        }
    }

    private playAnimation(animation: string) {
        if (!this.currentWeaponMesh) {
            return;
        }

        switch (animation) {
            case WeaponAnimation.Shoot:
                this.currentWeaponMesh.playShoot();
                break;
            case WeaponAnimation.Reload:
                this.currentWeaponMesh.playReload();
                break;
            case WeaponAnimation.Switch:
                this.currentWeaponMesh.playSwitch();
                break;
            default:
                this.currentWeaponMesh.playIdle();
                break;
        }
    }

    dispose() {
        if (this.currentWeaponMesh) {
            AssetManager.returnWeaponToPool(this.currentWeaponMesh);
            this.currentWeaponMesh = null;
        }

        if (this.weaponHolder.parent) {
            this.weaponHolder.parent.remove(this.weaponHolder);
        }

        this.shootParticle.dispose();
    }
}

// ─── WeaponSystem ──────────────────────────────────────────────────────

export class WeaponSystem {
    private player: PlayerController;
    private weaponRenderer: WeaponView;
    private hasInitializedWeapon = false;

    constructor(camera: FpsCamera, player: PlayerController, scene: GameScene) {
        this.player = player;
        this.weaponRenderer = new WeaponView(camera, scene);
        this.loadDefaultWeapon();
    }

    private async loadDefaultWeapon() {
        if (this.hasInitializedWeapon) {
            return;
        }
        await this.weaponRenderer.setWeapon(WeaponId.USP);
        this.hasInitializedWeapon = true;
    }

    processWeaponResult(result: WeaponProcessResult) {
        if (result.hasShoot) {
            this.weaponRenderer.playShoot(result);
        }

        if (result.hasSwitchToPrimary) {
            this.hasInitializedWeapon = true;
            this.weaponRenderer.setWeapon(WeaponId.AK47);
            this.weaponRenderer.playWeaponSwitchAnimation();
        }

        if (result.hasSwitchToSecondary) {
            this.hasInitializedWeapon = true;
            this.weaponRenderer.setWeapon(WeaponId.USP);
            this.weaponRenderer.playWeaponSwitchAnimation();
        }

        if (result.hasSwitchToKnife) {
            this.hasInitializedWeapon = true;
            this.weaponRenderer.setWeapon(WeaponId.KNIFE);
            this.weaponRenderer.playWeaponSwitchAnimation();
        }

        if (result.hasReload) {
            this.weaponRenderer.playWeaponReloadAnimation();
        }
    }

    async debugSetWeapon(weaponId: WeaponIdType) {
        this.hasInitializedWeapon = true;
        await this.weaponRenderer.setWeapon(weaponId);
    }

    debugSetViewModelTransform(transform: ViewModelDebugTransform) {
        this.weaponRenderer.debugSetCurrentTransform(transform);
    }

    debugGetViewModelState() {
        return this.weaponRenderer.debugGetCurrentState();
    }

    debugPlayWeaponAnimation(animation: string) {
        this.weaponRenderer.debugPlayAnimation(animation);
    }

    debugGetWeaponAnimations() {
        return this.weaponRenderer.debugGetAnimations();
    }

    debugPoseWeaponClip(clipName: string, time = 0) {
        return this.weaponRenderer.debugPoseClip(clipName, time);
    }

    update(delta: number, mouseMovement: { x: number; y: number }) {
        const weaponState = this.player.getCurrentWeaponState();
        if (weaponState) {
            this.weaponRenderer.update(delta, weaponState, mouseMovement, this.player.getVelocity());
        }
    }

    getCurrentWeaponState() {
        return this.player.getCurrentWeaponState();
    }

    getCurrentWeaponDefinition() {
        return this.player.getCurrentWeaponDefinition();
    }

    dispose() {
        this.weaponRenderer.dispose();
    }
}
