import * as THREE from 'three';

import { AssetManager, AudioManager } from '../assets/gameAssets';
import type { WeaponProcessResult, WeaponStateData } from '../runtime/player';
import type { WeaponId as WeaponIdType } from '../runtime/types';
import { WeaponAnimation } from '../runtime/types';
import { WeaponRegistry } from '../runtime/weapons';
import { ShootParticleSystem } from './effects';
import type { FpsCamera, GameScene } from './scene';

// biome-ignore lint/suspicious/noExplicitAny: AssetManager is @ts-nocheck, these types will be fixed in M2
export type WeaponMeshInstance = any;
export type ViewModelDebugTransform = {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
};

export class WeaponView {
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
            this.currentWeaponMesh = null;
            this.currentWeaponId = null;
        }

        const weaponMesh = AssetManager.getWeaponInstance(weaponId);
        if (!weaponMesh) {
            return;
        }

        this.currentWeaponMesh = weaponMesh;
        this.currentWeaponId = weaponId;

        if (!this.currentWeaponMesh.mesh) {
            AssetManager.returnWeaponToPool(this.currentWeaponMesh);
            this.currentWeaponMesh = null;
            this.currentWeaponId = null;
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
