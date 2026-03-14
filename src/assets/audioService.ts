import * as THREE from 'three';
import { AudioManager } from './gameAssets';

const POOL_SIZE = 8; // per sound family

type SoundPool = {
    sources: THREE.PositionalAudio[];
    nextIndex: number;
};

export class AudioService {
    private listener: THREE.AudioListener | null = null;
    private context: AudioContext | null = null;
    private attachedCamera: THREE.Camera | null = null;
    private buffers = new Map<string, AudioBuffer>();
    private pools = new Map<string, SoundPool>();
    private activeGlobal = new Set<THREE.Audio>();
    private isReady = false;

    /** Call once, from a user gesture or loading transition. */
    init(camera: THREE.Camera): void {
        if (this.isReady && this.listener && this.attachedCamera === camera) {
            return;
        }

        if (!this.listener) {
            this.listener = new THREE.AudioListener();
        } else if (this.listener.parent) {
            this.listener.parent.remove(this.listener);
        }

        camera.add(this.listener);
        this.attachedCamera = camera;
        this.context = this.listener.context;

        // Ensure low latency
        if (this.context.state === 'suspended') {
            void this.context.resume().catch(() => {});
        }

        this.isReady = true;
    }

    /** Warm up the AudioContext. Call from the first user click/interaction. */
    warmup(): void {
        AudioManager.warmup();
        if (this.context?.state === 'suspended') {
            this.context.resume();
        }
    }

    async loadBuffer(id: string, url: string): Promise<void> {
        if (!this.context) {
            return;
        }
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);
    }

    /** Play a one-shot positional sound using a pool. */
    playPositional(soundId: string, position: THREE.Vector3Like, volume = 1.0): void {
        if (!this.isReady || !this.listener) {
            return;
        }
        const buffer = this.buffers.get(soundId);
        if (!buffer) {
            return;
        }

        let pool = this.pools.get(soundId);
        if (!pool) {
            pool = this.createPool(soundId, buffer);
        }

        const index = pool.nextIndex % pool.sources.length;
        const audio = pool.sources[index];
        pool.nextIndex = (pool.nextIndex + 1) % pool.sources.length;

        if (!audio) {
            return;
        }

        if (audio.isPlaying) {
            audio.stop();
        }
        audio.setBuffer(buffer);
        audio.setRefDistance(5);
        audio.setRolloffFactor(2);
        audio.setVolume(volume);
        audio.position.set(position.x, position.y, position.z);
        audio.updateMatrixWorld(true);
        audio.play();
    }

    /** Play a non-spatial one-shot sound. */
    playGlobal(soundId: string, volume = 1.0): void {
        if (!this.isReady || !this.listener) {
            return;
        }
        const buffer = this.buffers.get(soundId);
        if (!buffer) {
            return;
        }

        const audio = new THREE.Audio(this.listener);
        this.activeGlobal.add(audio);
        audio.setBuffer(buffer);
        audio.setVolume(volume);
        audio.play();
        audio.onEnded = () => {
            audio.disconnect();
            this.activeGlobal.delete(audio);
        };
    }

    private createPool(soundId: string, buffer: AudioBuffer): SoundPool {
        if (!this.listener) {
            throw new Error('AudioService: listener not initialized');
        }

        const sources: THREE.PositionalAudio[] = [];
        for (let i = 0; i < POOL_SIZE; i++) {
            const audio = new THREE.PositionalAudio(this.listener);
            audio.setBuffer(buffer);
            sources.push(audio);
        }
        const pool: SoundPool = { nextIndex: 0, sources };
        this.pools.set(soundId, pool);
        return pool;
    }

    dispose(): void {
        for (const audio of this.activeGlobal) {
            if (audio.isPlaying) {
                audio.stop();
            }
            audio.disconnect();
        }
        this.activeGlobal.clear();
        for (const [, pool] of this.pools) {
            for (const source of pool.sources) {
                if (source.isPlaying) {
                    source.stop();
                }
                source.disconnect();
            }
        }
        this.pools.clear();
        this.buffers.clear();
        if (this.listener) {
            this.listener.parent?.remove(this.listener);
        }
        this.attachedCamera = null;
        this.isReady = false;
    }
}

// Singleton export
export const audioService = new AudioService();
