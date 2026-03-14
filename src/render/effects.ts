import * as THREE from 'three';
import { AssetManager } from '../assets/gameAssets';
import { AssetRegistry } from '../assets/registry';

type BillboardParticle = {
    duration: number;
    initialOpacity: number;
    position: THREE.Vector3;
    rotation: number;
    scale: number;
    startTime: number;
    velocity: THREE.Vector3;
};

type BulletCasingParticle = {
    duration: number;
    position: THREE.Vector3;
    rotation: THREE.Vector3;
    scale: number;
    startTime: number;
    velocity: THREE.Vector3;
};

function createRadialImpactTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext('2d');
    if (!context) {
        return createFallbackTexture();
    }
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
}

function createFallbackTexture(): THREE.Texture {
    return AssetManager.createFallbackTexture();
}

export class BulletHoleSystem {
    private scene: THREE.Scene;
    private maxDecals: number;
    private texture: THREE.Texture | null;
    private instancedMesh: THREE.InstancedMesh | null;
    private nextIndex: number;
    private dummy: THREE.Object3D;

    constructor(scene: THREE.Scene, maxDecals = 50) {
        this.scene = scene;
        this.maxDecals = maxDecals;
        this.texture = null;
        this.instancedMesh = null;
        this.nextIndex = 0;
        this.dummy = new THREE.Object3D();

        void this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await this.loadTextures();

            const geometry = new THREE.PlaneGeometry(0.15, 0.15);

            if (this.texture) {
                this.texture.magFilter = THREE.LinearFilter;
                this.texture.minFilter = THREE.LinearFilter;
                this.texture.generateMipmaps = false;
            }

            const material = new THREE.MeshBasicMaterial({
                alphaTest: 0.1,
                depthWrite: false,
                map: this.texture,
                opacity: 1,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
                side: THREE.DoubleSide,
                transparent: true,
            });

            this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxDecals);
            this.instancedMesh.frustumCulled = false;

            this.initializeInstances();
            this.scene.add(this.instancedMesh);
        } catch (error) {
            console.error('BulletHoleSystem: Failed to initialize', error);
        }
    }

    async loadTextures(): Promise<void> {
        const loader = new THREE.TextureLoader();

        try {
            this.texture = await loader.loadAsync(AssetRegistry.textures.bulletHole);
        } catch {
            this.texture = createRadialImpactTexture();
        }
    }

    initializeInstances(): void {
        if (!this.instancedMesh) {
            return;
        }

        const hiddenMatrix = new THREE.Matrix4();
        for (let index = 0; index < this.maxDecals; index += 1) {
            hiddenMatrix.makeScale(0, 0, 0);
            this.instancedMesh.setMatrixAt(index, hiddenMatrix);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    addBulletHole(position: THREE.Vector3, normal: THREE.Vector3, scale = 1): void {
        if (!this.instancedMesh) {
            return;
        }

        this.dummy.position.copy(position).add(normal.clone().multiplyScalar(0.005));
        this.dummy.lookAt(position.clone().add(normal));
        this.dummy.rotateZ(Math.random() * Math.PI * 2);
        this.dummy.scale.setScalar(scale);
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(this.nextIndex, this.dummy.matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.nextIndex = (this.nextIndex + 1) % this.maxDecals;
    }

    clearAllBulletHoles(): void {
        this.nextIndex = 0;
        this.initializeInstances();
    }

    dispose(): void {
        if (this.instancedMesh) {
            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh);
            }
            this.instancedMesh.geometry.dispose();

            if (this.instancedMesh.material instanceof THREE.Material) {
                this.instancedMesh.material.dispose();
            }

            this.instancedMesh = null;
        }

        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
    }
}

export class BillboardParticleSystem {
    private maxParticles: number;
    private particleCount: number;
    private geometry: THREE.InstancedBufferGeometry;
    private material: THREE.ShaderMaterial;
    private mesh: THREE.Mesh;
    private offsetAttribute: THREE.InstancedBufferAttribute;
    private scaleAttribute: THREE.InstancedBufferAttribute;
    private rotationAttribute: THREE.InstancedBufferAttribute;
    private opacityAttribute: THREE.InstancedBufferAttribute;
    private velocityAttribute: THREE.InstancedBufferAttribute;
    private timeAttribute: THREE.InstancedBufferAttribute;
    private durationAttribute: THREE.InstancedBufferAttribute;
    private uniforms: {
        uCurrentTime: THREE.IUniform<number>;
        uTexture: THREE.IUniform<THREE.Texture>;
        uViewMatrix: THREE.IUniform<THREE.Matrix4>;
    };

    constructor(parent: THREE.Object3D, texture: THREE.Texture, maxParticles: number, blending: THREE.Blending) {
        this.maxParticles = maxParticles;
        this.particleCount = 0;

        this.geometry = new THREE.InstancedBufferGeometry();
        const planeGeometry = new THREE.PlaneGeometry(1, 1);

        this.geometry.setIndex(planeGeometry.index);
        this.geometry.setAttribute('position', planeGeometry.getAttribute('position'));
        this.geometry.setAttribute('uv', planeGeometry.getAttribute('uv'));

        this.offsetAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles * 3), 3);
        this.scaleAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1);
        this.rotationAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1);
        this.opacityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1);
        this.velocityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles * 3), 3);
        this.timeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1);
        this.durationAttribute = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1);

        this.geometry.setAttribute('offset', this.offsetAttribute);
        this.geometry.setAttribute('aScale', this.scaleAttribute);
        this.geometry.setAttribute('aRotation', this.rotationAttribute);
        this.geometry.setAttribute('aOpacity', this.opacityAttribute);
        this.geometry.setAttribute('velocity', this.velocityAttribute);
        this.geometry.setAttribute('aTime', this.timeAttribute);
        this.geometry.setAttribute('aDuration', this.durationAttribute);

        this.uniforms = {
            uCurrentTime: { value: 0 },
            uTexture: { value: texture },
            uViewMatrix: { value: new THREE.Matrix4() },
        };

        this.material = new THREE.ShaderMaterial({
            blending,
            depthWrite: false,
            fragmentShader: `
        uniform sampler2D uTexture;

        varying vec2 vUv;
        varying float vOpacity;

        void main() {
          vec4 texColor = texture2D(uTexture, vUv);
          gl_FragColor = vec4(texColor.rgb, texColor.a * 2.0 * vOpacity);

          if (gl_FragColor.a < 0.01) {
            discard;
          }
        }
      `,
            side: THREE.DoubleSide,
            transparent: true,
            uniforms: this.uniforms,
            vertexShader: `
        attribute vec3 offset;
        attribute float aScale;
        attribute float aRotation;
        attribute float aOpacity;
        attribute vec3 velocity;
        attribute float aTime;
        attribute float aDuration;

        uniform float uCurrentTime;
        uniform mat4 uViewMatrix;

        varying vec2 vUv;
        varying float vOpacity;

        void main() {
          vUv = uv;

          float elapsed = uCurrentTime - aTime;
          float progress = clamp(elapsed / aDuration, 0.0, 1.0);
          vec3 currentPos = offset + velocity * elapsed;
          vec4 worldPosition = modelMatrix * vec4(currentPos, 1.0);

          vec3 cameraRight = vec3(uViewMatrix[0][0], uViewMatrix[1][0], uViewMatrix[2][0]);
          vec3 cameraUp = vec3(uViewMatrix[0][1], uViewMatrix[1][1], uViewMatrix[2][1]);

          vec2 rotatedPos = vec2(
            position.x * cos(aRotation) - position.y * sin(aRotation),
            position.x * sin(aRotation) + position.y * cos(aRotation)
          );

          vec3 billboardPos = worldPosition.xyz
            + cameraRight * rotatedPos.x * aScale
            + cameraUp * rotatedPos.y * aScale;

          vOpacity = aOpacity * (1.0 - progress);
          gl_Position = projectionMatrix * viewMatrix * vec4(billboardPos, 1.0);
        }
      `,
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        parent.add(this.mesh);
    }

    addParticle(particle: BillboardParticle): void {
        if (this.particleCount >= this.maxParticles) {
            return;
        }

        const index = this.particleCount;
        this.offsetAttribute.setXYZ(index, particle.position.x, particle.position.y, particle.position.z);
        this.scaleAttribute.setX(index, particle.scale);
        this.rotationAttribute.setX(index, particle.rotation);
        this.opacityAttribute.setX(index, particle.initialOpacity);
        this.velocityAttribute.setXYZ(index, particle.velocity.x, particle.velocity.y, particle.velocity.z);
        this.timeAttribute.setX(index, particle.startTime);
        this.durationAttribute.setX(index, particle.duration);

        this.particleCount += 1;
        this.geometry.instanceCount = this.particleCount;

        this.offsetAttribute.needsUpdate = true;
        this.scaleAttribute.needsUpdate = true;
        this.rotationAttribute.needsUpdate = true;
        this.opacityAttribute.needsUpdate = true;
        this.velocityAttribute.needsUpdate = true;
        this.timeAttribute.needsUpdate = true;
        this.durationAttribute.needsUpdate = true;
    }

    update(currentTime: number, camera: THREE.Camera): void {
        this.uniforms.uCurrentTime.value = currentTime;
        this.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
        this.removeExpiredParticles(currentTime);
    }

    removeExpiredParticles(currentTime: number): void {
        let writeIndex = 0;

        for (let index = 0; index < this.particleCount; index += 1) {
            const startTime = this.timeAttribute.getX(index);
            const duration = this.durationAttribute.getX(index);

            if (currentTime - startTime < duration) {
                if (writeIndex !== index) {
                    this.offsetAttribute.setXYZ(
                        writeIndex,
                        this.offsetAttribute.getX(index),
                        this.offsetAttribute.getY(index),
                        this.offsetAttribute.getZ(index),
                    );
                    this.scaleAttribute.setX(writeIndex, this.scaleAttribute.getX(index));
                    this.rotationAttribute.setX(writeIndex, this.rotationAttribute.getX(index));
                    this.opacityAttribute.setX(writeIndex, this.opacityAttribute.getX(index));
                    this.velocityAttribute.setXYZ(
                        writeIndex,
                        this.velocityAttribute.getX(index),
                        this.velocityAttribute.getY(index),
                        this.velocityAttribute.getZ(index),
                    );
                    this.timeAttribute.setX(writeIndex, startTime);
                    this.durationAttribute.setX(writeIndex, duration);
                }

                writeIndex += 1;
            }
        }

        if (writeIndex !== this.particleCount) {
            this.particleCount = writeIndex;
            this.geometry.instanceCount = this.particleCount;

            this.offsetAttribute.needsUpdate = true;
            this.scaleAttribute.needsUpdate = true;
            this.rotationAttribute.needsUpdate = true;
            this.opacityAttribute.needsUpdate = true;
            this.velocityAttribute.needsUpdate = true;
            this.timeAttribute.needsUpdate = true;
            this.durationAttribute.needsUpdate = true;
        }
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();

        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
    }

    get count(): number {
        return this.particleCount;
    }
}

export class ImpactParticleSystem {
    private parent: THREE.Object3D;
    private smokeTexture: THREE.Texture | null;
    private impactTexture: THREE.Texture | null;
    private smokeSystem: BillboardParticleSystem | null;
    private impactSystem: BillboardParticleSystem | null;
    private currentTime: number;

    constructor(parent: THREE.Object3D) {
        this.parent = parent;
        this.smokeTexture = null;
        this.impactTexture = null;
        this.smokeSystem = null;
        this.impactSystem = null;
        this.currentTime = 0;

        this.loadTextures();
    }

    async loadTextures(): Promise<void> {
        const loader = new THREE.TextureLoader();

        try {
            this.smokeTexture = await loader.loadAsync(AssetRegistry.textures.smoke);
            this.impactTexture = await loader.loadAsync(AssetRegistry.textures.sparks);
        } catch {
            this.smokeTexture = createFallbackTexture();
            this.impactTexture = createFallbackTexture();
        }

        this.initializeParticleSystems();
    }

    initializeParticleSystems(): void {
        if (!this.smokeTexture || !this.impactTexture) {
            return;
        }

        this.smokeSystem = new BillboardParticleSystem(this.parent, this.smokeTexture, 100, THREE.AdditiveBlending);
        this.impactSystem = new BillboardParticleSystem(this.parent, this.impactTexture, 50, THREE.NormalBlending);
    }

    createImpact(position: THREE.Vector3, normal: THREE.Vector3, scale = 1): void {
        this.createImpactSmoke(position, normal, scale);
        this.createImpactSparks(position, normal, scale);
    }

    createImpactSmoke(position: THREE.Vector3, normal: THREE.Vector3, scale: number): void {
        if (!this.smokeSystem) {
            return;
        }

        for (let index = 0; index < 5; index += 1) {
            const normalOffset = normal.clone().multiplyScalar(0.02 + 0.03 * Math.random());
            const jitter = new THREE.Vector3(
                0.1 * (Math.random() - 0.5),
                0.1 * (Math.random() - 0.5),
                0.1 * (Math.random() - 0.5),
            );
            const particlePosition = position.clone().add(normalOffset).add(jitter);
            const baseVelocity = normal.clone().multiplyScalar(0.8 + 1.2 * Math.random());
            const randomVelocity = new THREE.Vector3(
                2.5 * (Math.random() - 0.5),
                2.5 * (Math.random() - 0.5),
                2.5 * (Math.random() - 0.5),
            );

            this.smokeSystem.addParticle({
                duration: 600 + 600 * Math.random(),
                initialOpacity: 0.1 * scale,
                position: particlePosition,
                rotation: Math.random() * Math.PI * 2,
                scale: (1 + 0.04 * Math.random()) * scale,
                startTime: this.currentTime,
                velocity: baseVelocity.add(randomVelocity).multiplyScalar(0.003 * scale),
            });
        }
    }

    createImpactSparks(position: THREE.Vector3, normal: THREE.Vector3, scale: number): void {
        if (!this.impactSystem) {
            return;
        }

        for (let index = 0; index < 10; index += 1) {
            const normalOffset = normal.clone().multiplyScalar(0.01);
            const jitter = new THREE.Vector3(
                0.05 * (Math.random() - 0.5),
                0.05 * (Math.random() - 0.5),
                0.05 * (Math.random() - 0.5),
            );
            const particlePosition = position.clone().add(normalOffset).add(jitter);
            const velocity = new THREE.Vector3(
                0.5 * (Math.random() - 1),
                -2.5 * Math.random(),
                0.3 * (Math.random() - 1),
            ).add(normal.clone().multiplyScalar(1.2));

            this.impactSystem.addParticle({
                duration: 50 + 400 * Math.random(),
                initialOpacity: 0.8 * scale,
                position: particlePosition,
                rotation: Math.random() * Math.PI * 2,
                scale: 0.15 + 0.02 * Math.random(),
                startTime: this.currentTime,
                velocity: velocity.multiplyScalar(0.01 * scale),
            });
        }
    }

    update(delta: number, camera: THREE.Camera): void {
        this.currentTime += delta * 1000;

        if (this.smokeSystem) {
            this.smokeSystem.update(this.currentTime, camera);
        }

        if (this.impactSystem) {
            this.impactSystem.update(this.currentTime, camera);
        }
    }

    dispose(): void {
        if (this.smokeSystem) {
            this.smokeSystem.dispose();
        }

        if (this.impactSystem) {
            this.impactSystem.dispose();
        }

        if (this.smokeTexture) {
            this.smokeTexture.dispose();
        }

        if (this.impactTexture) {
            this.impactTexture.dispose();
        }
    }
}

export class BulletCasingParticleSystem {
    private parent: THREE.Object3D;
    private maxParticles: number;
    private particleCount: number;
    private particles: BulletCasingParticle[];
    private dummy: THREE.Object3D;
    private scratchPosition: THREE.Vector3;
    private scratchVelocity: THREE.Vector3;
    private instancedMesh: THREE.InstancedMesh | null;

    constructor(parent: THREE.Object3D, maxParticles: number) {
        this.parent = parent;
        this.maxParticles = maxParticles;
        this.particleCount = 0;
        this.particles = [];
        this.dummy = new THREE.Object3D();
        this.scratchPosition = new THREE.Vector3();
        this.scratchVelocity = new THREE.Vector3();
        this.instancedMesh = null;

        this.initializeBulletMesh();
    }

    async initializeBulletMesh(): Promise<void> {
        try {
            const model = AssetManager.getModel(AssetRegistry.weapons.bullet.model);
            if (!model) {
                return;
            }

            const meshes = AssetManager.extractMeshes(model.scene);
            if (meshes.length === 0) {
                return;
            }

            const sourceMesh = meshes[0];
            if (!sourceMesh) {
                return;
            }
            const geometry = sourceMesh.geometry.clone();
            const material = Array.isArray(sourceMesh.material)
                ? sourceMesh.material[0]?.clone()
                : sourceMesh.material.clone();
            if (!material) {
                return;
            }

            this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxParticles);
            this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.instancedMesh.count = 0;
            this.instancedMesh.frustumCulled = false;

            if (this.instancedMesh.geometry.boundingSphere) {
                this.instancedMesh.geometry.boundingSphere.radius = 10;
            }

            this.parent.add(this.instancedMesh);
        } catch {
            this.instancedMesh = null;
        }
    }

    addParticle(particle: BillboardParticle): void {
        if (!this.instancedMesh || this.particleCount >= this.maxParticles) {
            return;
        }

        this.particles[this.particleCount] = {
            duration: particle.duration,
            position: particle.position.clone(),
            rotation: new THREE.Vector3(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, particle.rotation),
            scale: particle.scale,
            startTime: particle.startTime,
            velocity: particle.velocity.clone(),
        };

        this.particleCount += 1;
        this.instancedMesh.count = this.particleCount;
    }

    update(currentTime: number): void {
        if (!this.instancedMesh) {
            return;
        }

        let writeIndex = 0;

        for (let index = 0; index < this.particleCount; index += 1) {
            const particle = this.particles[index];
            if (!particle) {
                continue;
            }
            const age = currentTime - particle.startTime;

            if (age < particle.duration) {
                const seconds = age / 1000;
                const position = this.scratchPosition
                    .copy(particle.position)
                    .add(this.scratchVelocity.copy(particle.velocity).multiplyScalar(age));

                position.y -= 4.905 * seconds * seconds * 0.001;

                this.dummy.position.copy(position);
                this.dummy.rotation.set(particle.rotation.x, particle.rotation.y, particle.rotation.z);
                this.dummy.scale.setScalar(particle.scale);
                this.dummy.updateMatrix();

                if (writeIndex !== index) {
                    this.particles[writeIndex] = particle;
                }

                this.instancedMesh.setMatrixAt(writeIndex, this.dummy.matrix);
                writeIndex += 1;
            }
        }

        this.particleCount = writeIndex;
        this.instancedMesh.count = writeIndex;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    dispose(): void {
        if (this.instancedMesh) {
            this.instancedMesh.geometry.dispose();

            if (this.instancedMesh.material instanceof THREE.Material) {
                this.instancedMesh.material.dispose();
            } else if (Array.isArray(this.instancedMesh.material)) {
                this.instancedMesh.material.forEach((material) => {
                    material.dispose();
                });
            }

            if (this.instancedMesh.parent) {
                this.instancedMesh.parent.remove(this.instancedMesh);
            }
        }

        this.particles = [];
    }

    get count(): number {
        return this.particleCount;
    }
}

export class ShootParticleSystem {
    private parent: THREE.Object3D;
    private muzzleFlashTexture: THREE.Texture | null;
    private smokeTexture: THREE.Texture | null;
    private muzzleFlashSystem: BillboardParticleSystem | null;
    private smokeSystem: BillboardParticleSystem | null;
    private bulletSystem: BulletCasingParticleSystem | null;
    private currentTime: number;

    constructor(parent: THREE.Object3D) {
        this.parent = parent;
        this.muzzleFlashTexture = null;
        this.smokeTexture = null;
        this.muzzleFlashSystem = null;
        this.smokeSystem = null;
        this.bulletSystem = null;
        this.currentTime = 0;

        this.loadTextures();
    }

    async loadTextures(): Promise<void> {
        const loader = new THREE.TextureLoader();

        try {
            this.muzzleFlashTexture = await loader.loadAsync(AssetRegistry.textures.muzzleFlash);
            this.smokeTexture = await loader.loadAsync(AssetRegistry.textures.smoke);
        } catch {
            this.muzzleFlashTexture = createFallbackTexture();
            this.smokeTexture = createFallbackTexture();
        }

        this.initializeParticleSystems();
    }

    initializeParticleSystems(): void {
        if (!this.muzzleFlashTexture || !this.smokeTexture) {
            return;
        }

        this.muzzleFlashSystem = new BillboardParticleSystem(
            this.parent,
            this.muzzleFlashTexture,
            50,
            THREE.NormalBlending,
        );
        this.smokeSystem = new BillboardParticleSystem(this.parent, this.smokeTexture, 200, THREE.NormalBlending);
        this.bulletSystem = new BulletCasingParticleSystem(this.parent, 100);
    }

    play(position: THREE.Vector3): void {
        if (!this.muzzleFlashSystem || !this.smokeSystem || !this.bulletSystem) {
            return;
        }

        this.createMuzzleFlash(position);
        this.createSmokeParticles(position);
        this.createBulletDrop(position);
    }

    createMuzzleFlash(position: THREE.Vector3): void {
        if (!this.muzzleFlashSystem) {
            return;
        }

        this.muzzleFlashSystem.addParticle({
            duration: 100,
            initialOpacity: 0.9 + 0.1 * Math.random(),
            position: position.clone(),
            rotation: -Math.PI / 2.5 + 1.2 * Math.random(),
            scale: 0.1 * (1.2 + 0.1 * Math.random()),
            startTime: this.currentTime,
            velocity: new THREE.Vector3(0, 0, 0),
        });
    }

    createSmokeParticles(position: THREE.Vector3): void {
        if (!this.smokeSystem) {
            return;
        }

        for (let index = 0; index < 30; index += 1) {
            const jitter = new THREE.Vector3(
                0.05 * (Math.random() - 0.5),
                0.05 * (Math.random() - 0.5),
                0.05 * (Math.random() - 0.5),
            );

            this.smokeSystem.addParticle({
                duration: 50 * index + 200 * Math.random(),
                initialOpacity: 0.05,
                position: position.clone().add(jitter),
                rotation: Math.random() * Math.PI * 2,
                scale: 0.04 * (1 + 0.5 * Math.random()),
                startTime: this.currentTime,
                velocity: new THREE.Vector3(
                    0.00016 * (Math.random() - 0.5),
                    0.0001 + 0.00019 * Math.random(),
                    0.00016 * (Math.random() - 0.5),
                ),
            });
        }
    }

    createBulletDrop(position: THREE.Vector3): void {
        if (!this.bulletSystem) {
            return;
        }

        const jitter = new THREE.Vector3(
            0.05 * (Math.random() - 0.5),
            0.05 * (Math.random() - 0.5),
            0.05 * (Math.random() - 0.5) + 0.15,
        );

        this.bulletSystem.addParticle({
            duration: 100 + 200 * Math.random(),
            initialOpacity: 1,
            position: position.clone().add(jitter),
            rotation: Math.random() * Math.PI * 2,
            scale: 0.01,
            startTime: this.currentTime,
            velocity: new THREE.Vector3(
                0.0001 + 0.005 * Math.random(),
                0.0001 - 0.0015 * Math.random(),
                0.001 + 0.0002 * Math.random(),
            ),
        });
    }

    update(delta: number, camera: THREE.Camera): void {
        this.currentTime += delta * 1000;

        if (this.muzzleFlashSystem) {
            this.muzzleFlashSystem.update(this.currentTime, camera);
        }

        if (this.smokeSystem) {
            this.smokeSystem.update(this.currentTime, camera);
        }

        if (this.bulletSystem) {
            this.bulletSystem.update(this.currentTime);
        }
    }

    dispose(): void {
        if (this.muzzleFlashSystem) {
            this.muzzleFlashSystem.dispose();
        }

        if (this.smokeSystem) {
            this.smokeSystem.dispose();
        }

        if (this.bulletSystem) {
            this.bulletSystem.dispose();
        }

        if (this.muzzleFlashTexture) {
            this.muzzleFlashTexture.dispose();
        }

        if (this.smokeTexture) {
            this.smokeTexture.dispose();
        }
    }

    getDebugInfo(): { bulletCount: number; bulletSystemActive: boolean } {
        return {
            bulletCount: this.bulletSystem ? this.bulletSystem.count : 0,
            bulletSystemActive: Boolean(this.bulletSystem),
        };
    }
}
