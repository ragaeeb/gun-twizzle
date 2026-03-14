import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';

import { AssetRegistry } from '../assets/registry';
import type { LevelDef } from '../content/levels/types';
import { BulletHoleSystem, ImpactParticleSystem } from './effects';

type LevelVisuals = Pick<
    LevelDef,
    'ambientColor' | 'ambientIntensity' | 'directionalColor' | 'directionalIntensity' | 'sunElevation'
>;

export class GameScene extends THREE.Scene {
    private directionalLight: THREE.DirectionalLight | null = null;
    private sky: Sky | null = null;
    private water: Water | null = null;
    private initialized = false;
    decalSystem: BulletHoleSystem | null = null;
    impactParticle: ImpactParticleSystem | null = null;
    private readonly lightOffset = new THREE.Vector3(150, 300, 100);
    private readonly targetOffset = new THREE.Vector3(0, -10, 0);

    initialize(visuals: LevelVisuals) {
        if (this.initialized) {
            return;
        }

        this.addSky(visuals.sunElevation);
        this.addLighting(visuals);
        this.decalSystem = new BulletHoleSystem(this);
        this.impactParticle = new ImpactParticleSystem(this);
        this.addWater();

        this.initialized = true;
    }

    attachCamera(camera: THREE.Camera) {
        if (camera.parent !== this) {
            this.add(camera);
        }
    }

    private addWater() {
        const waterGeometry = new THREE.PlaneGeometry(5000, 5000);
        const textureLoader = new THREE.TextureLoader();
        const waterNormals = textureLoader.load(AssetRegistry.textures.waterNormals, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        });

        this.water = new Water(waterGeometry, {
            distortionScale: 1,
            fog: this.fog !== undefined,
            sunColor: 0xffffff,
            sunDirection: new THREE.Vector3(),
            textureHeight: 512,
            textureWidth: 512,
            waterColor: 0x001e0f,
            waterNormals,
        });

        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -15;
        this.add(this.water);
    }

    private addLighting(visuals: LevelVisuals) {
        const groundColor = new THREE.Color(visuals.ambientColor).multiplyScalar(0.4);
        const hemisphereLight = new THREE.HemisphereLight(
            visuals.ambientColor,
            groundColor.getHex(),
            visuals.ambientIntensity,
        );
        hemisphereLight.position.set(0, 50, 0);
        this.add(hemisphereLight);

        this.directionalLight = new THREE.DirectionalLight(visuals.directionalColor, visuals.directionalIntensity);
        this.directionalLight.position.set(150, 400, 150);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        this.directionalLight.shadow.bias = -0.0005;
        this.directionalLight.shadow.normalBias = 0.05;
        this.directionalLight.shadow.radius = 0.5;
        this.add(this.directionalLight);
    }

    private addSky(sunElevationDeg: number) {
        const sunPosition = new THREE.Vector3();

        this.sky = new Sky();
        const skyUniforms = this.sky.material.uniforms;
        skyUniforms.turbidity!.value = 10;
        skyUniforms.rayleigh!.value = 0.5;
        skyUniforms.mieCoefficient!.value = 0.005;
        skyUniforms.mieDirectionalG!.value = 0.8;

        const phi = THREE.MathUtils.degToRad(90 - sunElevationDeg);
        const theta = THREE.MathUtils.degToRad(180);
        sunPosition.setFromSphericalCoords(1, phi, theta);

        skyUniforms.sunPosition!.value.copy(sunPosition);
        this.sky.scale.setScalar(450000);
        this.add(this.sky);
    }

    updateLightPosition(playerPosition: THREE.Vector3) {
        if (!this.directionalLight) {
            return;
        }

        this.directionalLight.position.copy(playerPosition).add(this.lightOffset);
        this.directionalLight.target.position.copy(playerPosition).add(this.targetOffset);
        this.directionalLight.target.updateMatrixWorld();
        this.directionalLight.shadow.camera.updateProjectionMatrix();
    }

    update(delta: number, camera: THREE.Camera) {
        this.impactParticle?.update(delta, camera);

        if (this.water) {
            this.water.material.uniforms.time!.value += delta;
        }
    }
}

export class FpsCamera extends THREE.PerspectiveCamera {
    static BASE_FOV = 80;
    static SPRINT_FOV = 100;
    private shakeIntensity = 0;
    private shakeDuration = 0;
    private shakeElapsed = 0;
    private baseRotationX = 0;
    private baseRotationY = 0;
    private targetFov = FpsCamera.BASE_FOV;

    constructor() {
        super(FpsCamera.BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 10000);

        this.rotation.order = 'YXZ';
    }

    moveOnMouseMove(event: MouseEvent) {
        this.baseRotationY -= event.movementX * 0.002;
        this.baseRotationX -= event.movementY * 0.002;
        this.baseRotationX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.baseRotationX));

        this.updateRotation();
    }

    shake(intensity = 0.5, duration = 150) {
        this.shakeIntensity = Math.max(intensity, this.shakeIntensity);
        this.shakeDuration = duration;
        this.shakeElapsed = 0;
    }

    setSprintFov(sprinting: boolean) {
        this.targetFov = sprinting ? FpsCamera.SPRINT_FOV : FpsCamera.BASE_FOV;
    }

    update(delta: number) {
        // Smooth FOV interpolation
        if (Math.abs(this.fov - this.targetFov) > 0.1) {
            this.fov += (this.targetFov - this.fov) * Math.min(6 * delta, 1);
            this.updateProjectionMatrix();
        }

        if (this.shakeElapsed < this.shakeDuration) {
            this.shakeElapsed += delta * 1000;

            const progress = this.shakeElapsed / this.shakeDuration;
            const remainingIntensity = this.shakeIntensity * (1 - progress);
            const shakeX = (Math.random() - 0.5) * remainingIntensity * 0.02;
            const shakeY = (Math.random() - 0.5) * remainingIntensity * 0.02;

            this.rotation.x = this.baseRotationX + shakeX;
            this.rotation.y = this.baseRotationY + shakeY;
            return;
        }

        this.updateRotation();
    }

    private updateRotation() {
        this.rotation.x = this.baseRotationX;
        this.rotation.y = this.baseRotationY;
    }
}
