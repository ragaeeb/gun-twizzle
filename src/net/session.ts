/**
 * NetSession — orchestrates the multiplayer lifecycle on the client.
 * Connects to the server, manages input sequencing, stores snapshots,
 * and provides the interface that GameEngine uses for prediction/reconciliation.
 *
 * When VITE_MULTIPLAYER_URL is not set, no NetSession is created and the game
 * runs in pure offline mode with zero networking overhead.
 */

import type { NetworkMode } from './config';
import { type BufferedInput, createInputBuffer, type InputBuffer } from './inputBuffer';
import {
    createInterpolationBuffer,
    type InterpolationBuffer,
    lerpTransform,
    type TransformSnapshot,
} from './interpolation';
import type {
    ClientMessage,
    SerializedInput,
    ServerMessage,
    ServerSnapshotMsg,
    ServerWelcomeMsg,
    Vec3Tuple,
    WorldSnapshot,
} from './protocol';
import { createWsTransport, type WsTransport } from './wsTransport';

export type NetSessionState = 'connecting' | 'connected' | 'disconnected';

export type NetSessionCallbacks = {
    onHitConfirm?: (targetId: number, damage: number, isHeadshot: boolean) => void;
    onPlayerJoin?: (playerId: string) => void;
    onPlayerLeave?: (playerId: string) => void;
    onSnapshot?: (snapshot: WorldSnapshot, tick: number) => void;
    onStateChange?: (state: NetSessionState) => void;
};

export type PendingSnapshot = {
    snapshot: WorldSnapshot;
    tick: number;
};

export type NetSession = {
    /** Destroy the session and release all resources. */
    destroy: () => void;
    /** Get the interpolation buffer for a remote player. */
    getPlayerInterpolation: (playerId: string) => InterpolationBuffer<TransformSnapshot> | undefined;
    /** Get buffered inputs that need to be re-applied during reconciliation. */
    getUnackedInputs: () => BufferedInput[];
    /** Whether the session has a confirmed player ID from the server. */
    isReady: () => boolean;
    /** The network mode. Always 'online' for an active session. */
    mode: NetworkMode;
    /** The local player's server-assigned ID, or null if not yet assigned. */
    playerId: () => string | null;
    /** Return and clear the latest unprocessed snapshot, or null if none pending. */
    popSnapshot: () => PendingSnapshot | null;
    /** Record a predicted input for potential reconciliation. */
    recordInput: (seq: number, input: SerializedInput, position: Vec3Tuple) => void;
    /** Send raw client message. Prefer `sendInput` for input frames. */
    send: (msg: ClientMessage) => void;
    /** Send a player input message, auto-incrementing the sequence number. */
    sendInput: (input: SerializedInput) => number;
    /** Current connection state. */
    state: () => NetSessionState;
};

export const createNetSession = (url: string, playerName: string, callbacks: NetSessionCallbacks = {}): NetSession => {
    let sessionState: NetSessionState = 'connecting';
    let localPlayerId: string | null = null;
    let inputSeq = 0;
    let pendingSnapshot: PendingSnapshot | null = null;

    const inputBuffer: InputBuffer = createInputBuffer();
    const playerInterpolations = new Map<string, InterpolationBuffer<TransformSnapshot>>();

    const setSessionState = (next: NetSessionState) => {
        sessionState = next;
        callbacks.onStateChange?.(next);
    };

    const handleWelcome = (msg: ServerWelcomeMsg) => {
        localPlayerId = msg.playerId;
        pendingSnapshot = { snapshot: msg.snapshot, tick: msg.tick };
        setSessionState('connected');
        callbacks.onSnapshot?.(msg.snapshot, msg.tick);
    };

    const handleSnapshot = (msg: ServerSnapshotMsg) => {
        pendingSnapshot = { snapshot: msg.snapshot, tick: msg.tick };

        // Acknowledge processed inputs
        if (localPlayerId && msg.lastInputSeq[localPlayerId] !== undefined) {
            inputBuffer.ack(msg.lastInputSeq[localPlayerId]!);
        }

        // Update interpolation buffers for remote players
        const now = performance.now();
        for (const player of msg.snapshot.players) {
            if (player.id === localPlayerId) {
                continue;
            }
            let buf = playerInterpolations.get(player.id);
            if (!buf) {
                buf = createInterpolationBuffer(lerpTransform);
                playerInterpolations.set(player.id, buf);
            }
            buf.push(msg.tick, now, {
                position: player.position,
                rotation: player.rotation,
            });
        }

        callbacks.onSnapshot?.(msg.snapshot, msg.tick);
    };

    const handleMessage = (msg: ServerMessage) => {
        switch (msg.type) {
            case 's:welcome':
                handleWelcome(msg);
                break;
            case 's:snapshot':
                handleSnapshot(msg);
                break;
            case 's:playerJoin':
                callbacks.onPlayerJoin?.(msg.playerId);
                break;
            case 's:playerLeave':
                playerInterpolations.delete(msg.playerId);
                callbacks.onPlayerLeave?.(msg.playerId);
                break;
            case 's:hitConfirm':
                callbacks.onHitConfirm?.(msg.targetId, msg.damage, msg.isHeadshot);
                break;
        }
    };

    const transport: WsTransport = createWsTransport({
        onClose: () => {
            if (sessionState !== 'disconnected') {
                setSessionState('disconnected');
            }
        },
        onMessage: handleMessage,
        onOpen: () => {
            transport.send({ name: playerName, type: 'c:join' });
        },
        url,
    });

    transport.connect();

    return {
        destroy: () => {
            setSessionState('disconnected');
            transport.close();
            playerInterpolations.clear();
        },

        getPlayerInterpolation: (playerId: string) => playerInterpolations.get(playerId),

        getUnackedInputs: () => inputBuffer.getUnacked(),

        isReady: () => localPlayerId !== null && sessionState === 'connected',

        mode: 'online',

        playerId: () => localPlayerId,

        popSnapshot: () => {
            const snap = pendingSnapshot;
            pendingSnapshot = null;
            return snap;
        },

        recordInput: (seq: number, input: SerializedInput, position: Vec3Tuple) => {
            inputBuffer.push({ input, position, seq });
        },

        send: (msg: ClientMessage) => transport.send(msg),

        sendInput: (input: SerializedInput) => {
            inputSeq += 1;
            transport.send({ input, seq: inputSeq, type: 'c:input' });
            return inputSeq;
        },

        state: () => sessionState,
    };
};
