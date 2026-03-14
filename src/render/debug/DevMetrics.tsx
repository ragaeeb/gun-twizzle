import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

const MAX_FRAME_SAMPLES = 600;
const LOG_INTERVAL_SECONDS = 5;

/**
 * Dev-only component that exposes renderer info and frame-time samples
 * on `window` for Playwright E2E tests and manual profiling.
 *
 * Rendered inside <Canvas> so it has access to the R3F state.
 */
export const DevMetrics = () => {
    const { gl } = useThree();
    const frameTimeSamples = useRef<number[]>(Array.from({ length: MAX_FRAME_SAMPLES }, () => 0));
    const orderedSamples = useRef<number[]>([]);
    const sampleIndex = useRef(0);
    const sampleCount = useRef(0);
    const lastLogTime = useRef(0);

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }

        // biome-ignore lint/suspicious/noExplicitAny: window accessor for E2E tests
        (window as any).__THREE_RENDERER_INFO__ = () => ({
            drawCalls: gl.info.render.calls,
            geometries: gl.info.memory.geometries,
            programs: gl.info.programs?.length ?? 0,
            textures: gl.info.memory.textures,
            triangles: gl.info.render.triangles,
        });

        // biome-ignore lint/suspicious/noExplicitAny: window accessor for E2E profiling
        (window as any).__SIM_PROFILE__ = () => {
            const entries = performance.getEntriesByType('measure');
            const result: Record<string, { avg: number; count: number }> = {};
            for (const entry of entries) {
                if (!entry.name.startsWith('sim:')) {
                    continue;
                }
                const existing = result[entry.name];
                if (!existing) {
                    result[entry.name] = { avg: entry.duration, count: 1 };
                } else {
                    existing.count += 1;
                    existing.avg += (entry.duration - existing.avg) / existing.count;
                }
            }
            return result;
        };

        return () => {
            // biome-ignore lint/suspicious/noExplicitAny: window accessor cleanup
            delete (window as any).__THREE_RENDERER_INFO__;
            // biome-ignore lint/suspicious/noExplicitAny: window accessor cleanup
            delete (window as any).__FRAME_TIME_SAMPLES__;
            // biome-ignore lint/suspicious/noExplicitAny: window accessor cleanup
            delete (window as any).__SIM_PROFILE__;
        };
    }, [gl]);

    useFrame((state, delta) => {
        if (!import.meta.env.DEV) {
            return;
        }

        const samples = frameTimeSamples.current;
        const value = delta * 1000;
        samples[sampleIndex.current] = value;
        sampleIndex.current = (sampleIndex.current + 1) % MAX_FRAME_SAMPLES;
        sampleCount.current = Math.min(sampleCount.current + 1, MAX_FRAME_SAMPLES);

        const count = sampleCount.current;
        const writeIndex = sampleIndex.current;
        const ordered = orderedSamples.current;
        for (let i = 0; i < count; i += 1) {
            const sourceIndex = (writeIndex - count + i + MAX_FRAME_SAMPLES) % MAX_FRAME_SAMPLES;
            ordered[i] = samples[sourceIndex] ?? 0;
        }
        ordered.length = count;
        // biome-ignore lint/suspicious/noExplicitAny: window accessor for E2E tests
        (window as any).__FRAME_TIME_SAMPLES__ = ordered;

        const elapsed = state.clock.elapsedTime;
        if (elapsed - lastLogTime.current >= LOG_INTERVAL_SECONDS) {
            lastLogTime.current = elapsed;
            const info = state.gl.info;
            console.log(
                `[Perf] Draw calls: ${info.render.calls}, Triangles: ${info.render.triangles}, Textures: ${info.memory.textures}, Geometries: ${info.memory.geometries}`,
            );
        }
    });

    return null;
};
