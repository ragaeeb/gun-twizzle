/**
 * WebSocket transport layer — thin wrapper around the browser WebSocket API.
 * Handles connection lifecycle, automatic reconnection, and message dispatch.
 */

import type { ClientMessage, ServerMessage } from './protocol';
import { decodeServerMessage, encodeMessage } from './protocol';

export type WsTransportOptions = {
    maxReconnectAttempts?: number;
    onClose?: () => void;
    onError?: (error: Event) => void;
    onMessage?: (msg: ServerMessage) => void;
    onOpen?: () => void;
    reconnectDelayMs?: number;
    url: string;
};

export type WsTransport = {
    /** Close the connection. No reconnection will be attempted. */
    close: () => void;
    /** Open the connection. */
    connect: () => void;
    /** True if the underlying WebSocket is in OPEN state. */
    isConnected: () => boolean;
    /** Send a client message. Silently drops if not connected. */
    send: (msg: ClientMessage) => void;
};

export const createWsTransport = (options: WsTransportOptions): WsTransport => {
    const { url, onOpen, onClose, onError, onMessage, maxReconnectAttempts = 5, reconnectDelayMs = 2000 } = options;

    let ws: WebSocket | null = null;
    let shouldReconnect = true;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    const attemptReconnect = () => {
        if (!shouldReconnect || reconnectAttempts >= maxReconnectAttempts) {
            return;
        }
        reconnectAttempts += 1;
        const delay = reconnectDelayMs * 1.5 ** (reconnectAttempts - 1);
        reconnectTimer = setTimeout(() => {
            connect();
        }, delay);
    };

    const connect = () => {
        cleanup();
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
            return;
        }
        shouldReconnect = true;

        ws = new WebSocket(url);

        ws.onopen = () => {
            reconnectAttempts = 0;
            onOpen?.();
        };

        ws.onmessage = (event) => {
            if (typeof event.data !== 'string') {
                return;
            }
            try {
                const msg = decodeServerMessage(event.data);
                onMessage?.(msg);
            } catch {
                // Ignore malformed messages
            }
        };

        ws.onclose = () => {
            onClose?.();
            if (shouldReconnect) {
                attemptReconnect();
            }
        };

        ws.onerror = (event) => {
            onError?.(event);
        };
    };

    return {
        close: () => {
            shouldReconnect = false;
            reconnectAttempts = 0;
            cleanup();
            ws?.close();
            ws = null;
        },

        connect,

        isConnected: () => ws?.readyState === WebSocket.OPEN,

        send: (msg: ClientMessage) => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(encodeMessage(msg));
            }
        },
    };
};
