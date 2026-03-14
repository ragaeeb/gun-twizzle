import { Perf } from 'r3f-perf';

/**
 * r3f-perf patches WebGLRenderer.render() for GPU timing queries.
 * This conflicts with Three.js Water's nested render() call (reflection pass),
 * causing INVALID_OPERATION errors that corrupt the WebGL state and produce
 * 0 draw calls (black screen). Only enable via ?perf=1 URL param when needed.
 *
 * For routine dev metrics, use DevMetrics instead (no render patching).
 */
export const PerfOverlay = () => {
    if (!import.meta.env.DEV) {
        return null;
    }
    const enabled = new URLSearchParams(window.location.search).get('perf') === '1';
    if (!enabled) {
        return null;
    }
    return <Perf position="top-left" />;
};
