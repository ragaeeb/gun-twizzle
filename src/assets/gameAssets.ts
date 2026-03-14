// @ts-nocheck
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

import { AssetRegistry } from '../assets/registry';
import { prepareWeaponAnimationClips } from '../runtime/weaponAnimationClips';
import { WeaponRegistry } from '../runtime/weapons';

function cloneScene(scene) {
    const clonedScene = cloneSkeleton(scene);
    clonedScene.animations = scene.animations;
    return clonedScene;
}

function createWhiteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1, 1);

    return new THREE.CanvasTexture(canvas);
}

function getAdditiveClipNames(clipMapJson) {
    if (!clipMapJson) {
        return [];
    }

    const additiveClipNames = new Set();
    for (const entry of Object.values(clipMapJson)) {
        const additive = entry.additive ?? entry.clip.toLowerCase().includes('additive');
        if (additive) {
            additiveClipNames.add(entry.clip);
        }
    }

    return Array.from(additiveClipNames);
}

// ─── Volume mixing presets ──────────────────────────────────────────────
const VOLUME_PRESETS = {
    ambient: 0.25,
    enemySfx: 0.7,
    music: 0.4,
    weaponSfx: 0.85,
};

const SFX_POOL_SIZE = 8;

// biome-ignore lint/complexity/noStaticOnlyClass: legacy static singleton to keep global audio state centralized.
class AudioManagerClass {
    static async init(camera) {
        if (AudioManagerClass.isInitialized) {
            return;
        }

        AudioManagerClass.camera = camera;
        AudioManagerClass.listener = new THREE.AudioListener();
        AudioManagerClass.camera.add(AudioManagerClass.listener);
        AudioManagerClass.isInitialized = true;
    }

    static get initialized() {
        return AudioManagerClass.isInitialized;
    }

    static warmup() {
        const context = AudioManagerClass.listener?.context;
        if (context?.state === 'suspended') {
            void context.resume().catch(() => {});
        }
    }

    static async loadSound(key, path) {
        if (!AudioManagerClass.isInitialized) {
            throw new Error('AudioManager not initialized. Call AudioManager.init() first.');
        }

        return new Promise((resolve, reject) => {
            AudioManagerClass.audioLoader.load(
                path,
                (buffer) => {
                    AudioManagerClass.loadedBuffers.set(key, buffer);
                    resolve();
                },
                undefined,
                reject,
            );
        });
    }

    static async loadGameAudio() {
        if (!AudioManagerClass.isInitialized) {
            throw new Error('AudioManager not initialized. Call AudioManager.init() first.');
        }

        const sounds = [
            { key: 'gunshot', path: AssetRegistry.sounds.gunshot },
            { key: 'gunshot2', path: AssetRegistry.sounds.gunshot2 },
            { key: 'switch', path: AssetRegistry.sounds.switch },
            { key: 'clip', path: AssetRegistry.sounds.clip },
            { key: 'draw', path: AssetRegistry.sounds.draw },
            { key: 'bullet', path: AssetRegistry.sounds.bullet },
            { key: 'bullet2', path: AssetRegistry.sounds.bullet2 },
            { key: 'knife', path: AssetRegistry.sounds.knife },
            { key: 'draw2', path: AssetRegistry.sounds.draw2 },
            { key: 'draw3', path: AssetRegistry.sounds.draw3 },
            { key: 'tac', path: AssetRegistry.sounds.tac },
            { key: 'load', path: AssetRegistry.sounds.load },
            { key: 'crack', path: AssetRegistry.sounds.crack },
        ];

        await Promise.all(sounds.map(({ key, path }) => AudioManagerClass.loadSound(key, path).catch(() => {})));
    }

    static playSoundscape(ambientSoundKey) {
        if (!ambientSoundKey) {
            return;
        }

        AudioManagerClass.warmup();

        AudioManagerClass.stopSound('__ambient__');

        const buffer = AudioManagerClass.loadedBuffers.get(ambientSoundKey);
        if (!buffer || !AudioManagerClass.listener) {
            return;
        }

        const sound = new THREE.Audio(AudioManagerClass.listener);
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(VOLUME_PRESETS.ambient * AudioManagerClass.sfxVolume * AudioManagerClass.masterVolume);
        sound.play();
        AudioManagerClass.loadedSounds.set('__ambient__', sound);
    }

    static stopSoundscape() {
        AudioManagerClass.stopSound('__ambient__');
    }

    static playMenuMusic() {
        AudioManagerClass.playMusic('menu_music', VOLUME_PRESETS.music);
    }

    static getSfxPoolSource(key) {
        let pool = AudioManagerClass.sfxPool.get(key);
        if (!pool) {
            pool = { nextIndex: 0, sources: [] };
            AudioManagerClass.sfxPool.set(key, pool);
        }

        if (pool.sources.length < SFX_POOL_SIZE) {
            const sound = new THREE.Audio(AudioManagerClass.listener);
            pool.sources.push(sound);
            return sound;
        }

        const source = pool.sources[pool.nextIndex % SFX_POOL_SIZE];
        pool.nextIndex = (pool.nextIndex + 1) % SFX_POOL_SIZE;

        if (source.isPlaying) {
            source.stop();
        }

        return source;
    }

    static playSFX(key, volume = 1, loop = false) {
        if (!AudioManagerClass.isInitialized || !AudioManagerClass.listener) {
            return null;
        }

        AudioManagerClass.warmup();

        const buffer = AudioManagerClass.loadedBuffers.get(key);
        if (!buffer) {
            return null;
        }

        const sound = loop ? new THREE.Audio(AudioManagerClass.listener) : AudioManagerClass.getSfxPoolSource(key);
        sound.setBuffer(buffer);
        sound.setLoop(loop);
        sound.setVolume(
            volume * VOLUME_PRESETS.weaponSfx * AudioManagerClass.sfxVolume * AudioManagerClass.masterVolume,
        );
        sound.play();

        if (loop) {
            sound.onEnded = () => {
                sound.disconnect();
            };
        }

        return sound;
    }

    static playMusic(key, volume = 1, loop = true) {
        if (!AudioManagerClass.isInitialized || !AudioManagerClass.listener) {
            return null;
        }

        AudioManagerClass.warmup();

        const buffer = AudioManagerClass.loadedBuffers.get(key);
        if (!buffer) {
            return null;
        }

        AudioManagerClass.stopSound(key);

        const sound = new THREE.Audio(AudioManagerClass.listener);
        sound.setBuffer(buffer);
        sound.setLoop(loop);
        sound.setVolume(volume * AudioManagerClass.musicVolume * AudioManagerClass.masterVolume);
        sound.play();
        AudioManagerClass.loadedSounds.set(key, sound);

        return sound;
    }

    static playPositionalSFX(key, position, volume = 1, refDistance = 5, rolloffFactor = 2, loop = false) {
        if (!AudioManagerClass.isInitialized || !AudioManagerClass.listener) {
            return null;
        }

        AudioManagerClass.warmup();

        const buffer = AudioManagerClass.loadedBuffers.get(key);
        if (!buffer) {
            return null;
        }

        const sound = new THREE.PositionalAudio(AudioManagerClass.listener);
        sound.setBuffer(buffer);
        sound.setRefDistance(refDistance);
        sound.setRolloffFactor(rolloffFactor);
        sound.setLoop(loop);
        sound.setVolume(
            volume * VOLUME_PRESETS.enemySfx * AudioManagerClass.sfxVolume * AudioManagerClass.masterVolume,
        );
        sound.position.copy(position);
        sound.play();

        if (!loop) {
            sound.onEnded = () => {
                sound.disconnect();
            };
        }

        return sound;
    }

    static stopSound(key) {
        const sound = AudioManagerClass.loadedSounds.get(key);
        if (sound?.isPlaying) {
            sound.stop();
            sound.disconnect();
            AudioManagerClass.loadedSounds.delete(key);
        }
    }

    static stopAllSounds() {
        AudioManagerClass.loadedSounds.forEach((sound) => {
            if (sound.isPlaying) {
                sound.stop();
                sound.disconnect();
            }
        });
        AudioManagerClass.loadedSounds.clear();
    }

    static pauseSound(key) {
        const sound = AudioManagerClass.loadedSounds.get(key);
        if (sound?.isPlaying) {
            sound.pause();
        }
    }

    static resumeSound(key) {
        const sound = AudioManagerClass.loadedSounds.get(key);
        if (sound && !sound.isPlaying) {
            sound.play();
        }
    }

    static setMasterVolume(volume) {
        AudioManagerClass.masterVolume = Math.max(0, Math.min(1, volume));
        AudioManagerClass.updateAllVolumes();
    }

    static setSFXVolume(volume) {
        AudioManagerClass.sfxVolume = Math.max(0, Math.min(1, volume));
        AudioManagerClass.updateAllVolumes();
    }

    static setMusicVolume(volume) {
        AudioManagerClass.musicVolume = Math.max(0, Math.min(1, volume));
        AudioManagerClass.updateAllVolumes();
    }

    static getMasterVolume() {
        return AudioManagerClass.masterVolume;
    }

    static getSFXVolume() {
        return AudioManagerClass.sfxVolume;
    }

    static getMusicVolume() {
        return AudioManagerClass.musicVolume;
    }

    static updateAllVolumes() {
        AudioManagerClass.loadedSounds.forEach((sound) => {
            sound.setVolume(AudioManagerClass.masterVolume * AudioManagerClass.sfxVolume);
        });
    }

    static dispose() {
        AudioManagerClass.stopAllSounds();
        AudioManagerClass.loadedBuffers.clear();
        AudioManagerClass.loadedSounds.clear();

        for (const [, pool] of AudioManagerClass.sfxPool) {
            for (const source of pool.sources) {
                if (source.isPlaying) {
                    source.stop();
                }
                source.disconnect();
            }
        }
        AudioManagerClass.sfxPool.clear();

        if (AudioManagerClass.listener && AudioManagerClass.camera) {
            AudioManagerClass.camera.remove(AudioManagerClass.listener);
        }

        AudioManagerClass.listener = null;
        AudioManagerClass.camera = null;
        AudioManagerClass.isInitialized = false;
    }
}

AudioManagerClass.listener = null;
AudioManagerClass.camera = null;
AudioManagerClass.loadedSounds = new Map();
AudioManagerClass.loadedBuffers = new Map();
AudioManagerClass.sfxPool = new Map();
AudioManagerClass.audioLoader = new THREE.AudioLoader();
AudioManagerClass.masterVolume = 1;
AudioManagerClass.sfxVolume = 1;
AudioManagerClass.musicVolume = 1;
AudioManagerClass.isInitialized = false;

class FpsWeaponMesh {
    constructor(path, key) {
        this.path = path;
        this.key = key;
        this.mesh = null;
        this.mixer = null;
        this.lastAnimationDuration = 0;
        this.animationMarkers = new Map();
        this.soundMarkers = [];
        this.currentAnimIsLoop = false;
        this.currentAnim = null;
        this.isAnimationFinished = true;
        this.playedSounds = new Set();
        this.clipBased = false;
        this.clipMap = new Map();
        this.currentClipAction = null;
        this.debugPoseLocked = false;
    }

    async load() {
        const gltf = await AssetManager.loadModel(this.path);
        this.mesh = gltf.scene;

        const markerPath = WeaponRegistry.get(this.key)?.markerPath ?? this.path.replace(/\.(glb|gltf)$/i, '.json');
        const markerJson = await AssetManager.loadJson(markerPath);
        const isClipBased = Boolean(markerJson?.clipBased && markerJson.clipMap);
        const clipMapJson = isClipBased ? markerJson.clipMap : undefined;
        const modelScale = WeaponRegistry.get(this.key)?.modelScale;
        this.mesh.animations = prepareWeaponAnimationClips({
            additiveClipNames: getAdditiveClipNames(clipMapJson),
            clipBased: isClipBased,
            clips: gltf.animations,
            modelScale,
        });

        if (isClipBased) {
            this.clipBased = true;
            this.setClipMapData(clipMapJson);
        } else if (markerJson && Array.isArray(markerJson.markers)) {
            this.setMarkerData(markerJson.markers);
        }

        this.init();
    }

    setClipMapData(clipMapJson) {
        this.clipMap = new Map();
        for (const [animName, entry] of Object.entries(clipMapJson)) {
            this.clipMap.set(animName, {
                additive: entry.additive ?? entry.clip.toLowerCase().includes('additive'),
                clipName: entry.clip,
                loop: entry.loop ?? false,
            });
        }
    }

    setMarkerData(markers) {
        const animationMarkers = new Map();
        const soundMarkers = [];

        for (const marker of markers) {
            if (marker.name.startsWith('Sound_')) {
                soundMarkers.push({
                    marker,
                    name: marker.name.replace('Sound_', ''),
                });
                continue;
            }

            const [name, type] = marker.name.split('_');
            if (!name || !type) {
                continue;
            }

            const animationMarker = animationMarkers.get(name) || {
                End: undefined,
                name,
                Start: undefined,
            };

            if (type === 'Start') {
                animationMarker.Start = marker;
            } else if (type === 'End') {
                animationMarker.End = marker;
            }

            animationMarkers.set(name, animationMarker);
        }

        this.animationMarkers = animationMarkers;
        this.soundMarkers = soundMarkers;
    }

    init() {
        if (!this.mesh) {
            throw new Error('Mesh is not set for FpsWeaponMesh');
        }

        this.mixer = new THREE.AnimationMixer(this.mesh);
        this.mesh.frustumCulled = false;
        this.mesh.traverse((child) => {
            if (child.type === 'SkinnedMesh') {
                child.frustumCulled = false;
            }
        });
    }

    update(delta) {
        if (!this.mixer) {
            return;
        }

        if (this.debugPoseLocked) {
            return;
        }

        if (this.clipBased) {
            this.mixer.update(delta);
            if (this.currentClipAction && !this.currentAnimIsLoop) {
                const clip = this.currentClipAction.getClip();
                if (!this.currentClipAction.isRunning() || this.currentClipAction.time >= clip.duration) {
                    this.isAnimationFinished = true;
                }
            }
            return;
        }

        if (this.lastAnimationDuration && this.mixer.time < this.lastAnimationDuration) {
            this.mixer.update(delta);
            this.isAnimationFinished = false;
            this.playSoundMarkers();
            return;
        }

        if (this.currentAnimIsLoop && this.currentAnim) {
            this.playAnimationSegment(this.currentAnim);
            return;
        }

        this.isAnimationFinished = true;
    }

    playSoundMarkers() {
        if (!this.currentAnim || !this.mixer) {
            return;
        }

        const mixerTime = this.mixer.time;
        const startTime = this.currentAnim.Start?.time || 0;
        const endTime = this.currentAnim.End?.time || 0;
        const absoluteTime = mixerTime + startTime;

        for (let index = 0; index < this.soundMarkers.length; index += 1) {
            const soundMarker = this.soundMarkers[index];
            const soundTime = soundMarker.marker.time;
            const soundKey = `${this.currentAnim.name}_${soundMarker.name}_${index}`;

            if (
                soundTime >= startTime &&
                soundTime <= endTime &&
                absoluteTime >= soundTime &&
                !this.playedSounds.has(soundKey)
            ) {
                AudioManager.playSFX(soundMarker.name, 1, false);
                this.playedSounds.add(soundKey);
            }
        }
    }

    playAnimation(name, loop = false, force = true) {
        this.debugPoseLocked = false;

        if (this.clipBased) {
            this.playClipAnimation(name, loop, force);
            return;
        }

        const marker = this.animationMarkers.get(name);
        if (!marker) {
            return;
        }

        if (!force && this.currentAnim && marker.name === this.currentAnim.name) {
            return;
        }

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        this.currentAnimIsLoop = loop;
        this.isAnimationFinished = false;
        this.playAnimationSegment(marker);
    }

    isCurrentClipAction(clip, force) {
        if (force || !this.currentClipAction) {
            return false;
        }

        return this.currentClipAction.getClip().name === clip.name;
    }

    configureClipAction(action, entry, useLoop) {
        if (entry.additive) {
            if (this.currentClipAction && this.currentClipAction !== action && !this.currentAnimIsLoop) {
                this.currentClipAction.stop();
            }
        } else {
            this.mixer.stopAllAction();
        }

        action.blendMode = entry.additive ? THREE.AdditiveAnimationBlendMode : THREE.NormalAnimationBlendMode;
        action.loop = useLoop ? THREE.LoopRepeat : THREE.LoopOnce;
        action.clampWhenFinished = entry.additive ? false : !useLoop;
        action.enabled = true;
        action.reset();
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
    }

    playClipAnimation(name, loop, force) {
        if (!this.mixer || !this.mesh) {
            return;
        }

        const entry = this.clipMap.get(name);
        if (!entry) {
            return;
        }

        const clip = this.mesh.animations.find((c) => c.name === entry.clipName);
        if (!clip) {
            return;
        }

        if (this.isCurrentClipAction(clip, force)) {
            return;
        }

        const useLoop = loop || entry.loop;
        const action = this.mixer.clipAction(clip);
        this.configureClipAction(action, entry, useLoop);
        action.play();

        this.currentClipAction = action;
        this.currentAnimIsLoop = useLoop;
        this.isAnimationFinished = false;
    }

    playAnimationSegment(marker) {
        if (!this.mixer || !marker.Start || !marker.End || !this.mesh) {
            return;
        }

        this.currentAnim = marker;
        this.playedSounds.clear();
        this.lastAnimationDuration = marker.End.time - marker.Start.time;
        this.mixer.time = 0;
        this.mixer.timeScale = 1;
        this.isAnimationFinished = false;

        for (const clip of this.mesh.animations || []) {
            const action = this.mixer.clipAction(clip);
            action.loop = THREE.LoopOnce;
            action.time = Math.abs(marker.Start.time);
            action.clampWhenFinished = true;
            action.play();
        }
    }

    playIdle() {
        this.playAnimation('Idle', true, true);
    }

    playShoot() {
        this.playAnimation('Shoot', false, true);
    }

    playSwitch() {
        this.playAnimation('Switch', false, true);
    }

    playReload() {
        this.playAnimation('Reload', false, true);
    }

    getAnimationNames() {
        return (this.mesh?.animations ?? []).map((clip) => ({
            duration: clip.duration,
            name: clip.name,
        }));
    }

    debugPoseClip(clipName, time = 0) {
        if (!this.mesh || !this.mixer) {
            return false;
        }

        const clip = clipName
            ? this.mesh.animations.find((candidate) => candidate.name === clipName)
            : this.mesh.animations[0];
        if (!clip) {
            return false;
        }

        this.mixer.stopAllAction();

        const action = this.mixer.clipAction(clip);
        action.enabled = true;
        action.clampWhenFinished = true;
        action.reset();
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.setLoop(THREE.LoopOnce, 0);
        action.play();

        this.currentClipAction = action;
        this.currentAnimIsLoop = false;
        this.currentAnim = null;
        this.isAnimationFinished = true;
        this.debugPoseLocked = true;

        const clampedTime = THREE.MathUtils.clamp(time, 0, clip.duration);
        this.mixer.update(0);
        this.mixer.setTime(clampedTime);
        action.paused = true;

        return true;
    }

    isCurrentAnimationFinished() {
        return this.isAnimationFinished;
    }

    isClipBasedAnimation() {
        return this.clipBased;
    }

    isDebugPoseLocked() {
        return this.debugPoseLocked;
    }

    clone() {
        if (!this.mesh) {
            throw new Error(`Cannot clone unloaded mesh: ${this.key}`);
        }

        const cloned = new FpsWeaponMesh(this.path, this.key);
        cloned.mesh = cloneScene(this.mesh);
        cloned.mesh.animations = this.mesh.animations;
        cloned.animationMarkers = this.animationMarkers;
        cloned.soundMarkers = this.soundMarkers;
        cloned.clipBased = this.clipBased;
        cloned.clipMap = this.clipMap;
        cloned.init();
        return cloned;
    }

    dispose() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.mesh);
            this.mixer = null;
        }

        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.type !== 'Mesh') {
                    return;
                }

                const mesh = child;
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }

                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((material) => {
                            material.dispose();
                        });
                    } else {
                        mesh.material.dispose();
                    }
                }
            });

            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
        }
    }
}

// biome-ignore lint/complexity/noStaticOnlyClass: asset cache is intentionally global and static.
class AssetManagerClass {
    static getModel(path) {
        const gltf = AssetManagerClass.loadedModels.get(path);
        if (!gltf) {
            return null;
        }

        return {
            ...gltf,
            scene: cloneScene(gltf.scene),
        };
    }

    static async loadModel(path) {
        const cached = AssetManagerClass.loadedModels.get(path);
        if (cached) {
            return {
                ...cached,
                scene: cloneScene(cached.scene),
            };
        }

        const gltf = await AssetManagerClass.gltfLoader.loadAsync(path);
        AssetManagerClass.loadedModels.set(path, gltf);

        return {
            ...gltf,
            scene: cloneScene(gltf.scene),
        };
    }

    static extractMeshes(root) {
        const meshes = [];
        root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                meshes.push(child);
            }
        });
        return meshes;
    }

    static async loadJson(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load JSON at path ${path}: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch {
            return undefined;
        }
    }

    static async registerAnimatedWeapon(key, modelPath) {
        const template = new FpsWeaponMesh(modelPath, key);
        await template.load();
        AssetManagerClass.clonableFpsMeshes.set(key, template);
    }

    static async initializeWeapons() {
        WeaponRegistry.initializeWeaponDefinitions();

        await Promise.all(
            WeaponRegistry.getAll().map((weapon) =>
                AssetManagerClass.registerAnimatedWeapon(weapon.id, weapon.modelPath),
            ),
        );

        await AssetManagerClass.loadModel(AssetRegistry.weapons.bullet.model);
    }

    static getWeaponInstance(key) {
        const template = AssetManagerClass.clonableFpsMeshes.get(key);
        if (!template) {
            return null;
        }

        const pool = AssetManagerClass.fpsMeshPool.get(key) || [];
        return pool.length > 0 ? pool.pop() : template.clone();
    }

    static returnWeaponToPool(instance) {
        const key = instance.key;
        if (!AssetManagerClass.fpsMeshPool.has(key)) {
            AssetManagerClass.fpsMeshPool.set(key, []);
        }

        const pool = AssetManagerClass.fpsMeshPool.get(key);

        if (pool.length < AssetManagerClass.MAX_POOL_SIZE) {
            if (instance.mixer) {
                instance.mixer.stopAllAction();
            }

            if (instance.mesh?.parent) {
                instance.mesh.parent.remove(instance.mesh);
            }

            pool.push(instance);
            return;
        }

        instance.dispose();
    }

    static createFallbackTexture() {
        return createWhiteTexture();
    }
}

AssetManagerClass.gltfLoader = new GLTFLoader();
AssetManagerClass.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
AssetManagerClass.loadedModels = new Map();
AssetManagerClass.clonableFpsMeshes = new Map();
AssetManagerClass.fpsMeshPool = new Map();
AssetManagerClass.MAX_POOL_SIZE = 5;

export const AudioManager = AudioManagerClass;
export const AssetManager = AssetManagerClass;
