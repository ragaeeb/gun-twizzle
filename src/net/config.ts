/**
 * Network configuration — reads VITE_MULTIPLAYER_URL to determine mode.
 * When the env var is absent (e.g. Vercel deploy), multiplayer is fully disabled
 * and no WebSocket connection is ever attempted.
 */

export type NetworkMode = 'offline' | 'online';

export const getServerUrl = (): string | null => {
    const raw = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined;
    const trimmed = raw?.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
};

export const getNetworkMode = (): NetworkMode => {
    return getServerUrl() !== null ? 'online' : 'offline';
};
