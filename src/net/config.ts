/**
 * Network configuration — reads VITE_MULTIPLAYER_URL to determine mode.
 * When the env var is absent (e.g. Vercel deploy), multiplayer is fully disabled
 * and no WebSocket connection is ever attempted.
 */

export type NetworkMode = 'offline' | 'online';

export const getServerUrl = (): string | null => {
    const url = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined;
    return url && url.length > 0 ? url : null;
};

export const getNetworkMode = (): NetworkMode => {
    return getServerUrl() !== null ? 'online' : 'offline';
};
