import { describe, expect, it, vi } from 'vitest';

const { nextId, playCalls, MockAudioListener, MockPositionalAudio, MockAudio, MockCamera } = vi.hoisted(() => {
    const nextIdState = { value: 0 };
    const playCallsState: number[] = [];

    class MockAudioListener {
        context = {
            resume: vi.fn().mockResolvedValue(undefined),
            state: 'running',
        };
        parent: { remove: (listener: MockAudioListener) => void } | null = null;
    }

    class MockPositionalAudio {
        isPlaying = false;
        position = {
            set: (x: number, y: number, z: number) => {
                this.position.x = x;
                this.position.y = y;
                this.position.z = z;
            },
            x: 0,
            y: 0,
            z: 0,
        };
        private id = nextIdState.value++;

        setBuffer(_buffer: AudioBuffer) {}
        setRefDistance(_value: number) {}
        setRolloffFactor(_value: number) {}
        setVolume(_value: number) {}
        updateMatrixWorld(_force: boolean) {}

        play() {
            this.isPlaying = true;
            playCallsState.push(this.id);
        }

        stop() {
            this.isPlaying = false;
        }

        disconnect() {}
    }

    class MockAudio {
        isPlaying = false;
        onEnded: (() => void) | null = null;

        setBuffer(_buffer: AudioBuffer) {}
        setVolume(_value: number) {}

        play() {
            this.isPlaying = true;
        }

        stop() {
            this.isPlaying = false;
        }

        disconnect() {}
    }

    class MockCamera {
        add(listener: MockAudioListener) {
            listener.parent = this;
        }

        remove(listener: MockAudioListener) {
            listener.parent = null;
        }
    }

    return {
        MockAudio,
        MockAudioListener,
        MockCamera,
        MockPositionalAudio,
        nextId: nextIdState,
        playCalls: playCallsState,
    };
});

vi.mock('three', async (importOriginal) => {
    const actual = await importOriginal<typeof import('three')>();
    return {
        ...actual,
        Audio: MockAudio,
        AudioListener: MockAudioListener,
        PositionalAudio: MockPositionalAudio,
    };
});

import { AudioService } from '../audioService';

describe('AudioService pool bounds', () => {
    const soundId = 'gunshot';

    const createService = () => {
        const service = new AudioService();
        const camera = new MockCamera();
        service.init(camera as unknown as Parameters<AudioService['init']>[0]);
        (service as unknown as { buffers: Map<string, AudioBuffer> }).buffers.set(soundId, {} as AudioBuffer);
        return service;
    };

    it('grows a pool up to the max and reuses indices after', () => {
        nextId.value = 0;
        playCalls.length = 0;

        const service = createService();

        for (let i = 0; i < 10; i += 1) {
            service.playPositional(soundId, { x: 0, y: 0, z: 0 });
        }

        const pools = (service as unknown as { pools: Map<string, { sources: unknown[] }> }).pools;
        const pool = pools.get(soundId);
        expect(pool).toBeDefined();
        expect(pool?.sources.length).toBe(8);

        expect(playCalls.length).toBe(10);
        const firstCycle = new Set(playCalls.slice(0, 8));
        expect(firstCycle.size).toBe(8);
        expect(playCalls[0]).toBe(playCalls[8]);
        expect(playCalls[1]).toBe(playCalls[9]);
    });
});
