/**
 * Room — manages connected players and their state within a single game room.
 * M6 supports exactly one room with up to 2 player slots.
 */

import type { QuatTuple, ServerMessage, Vec3Tuple } from '../src/net/protocol';
import { encodeMessage } from '../src/net/protocol';

const MAX_PLAYERS = 2;

export type PlayerSlot = {
    id: string;
    lastInputSeq: number;
    lookRotation: QuatTuple;
    name: string;
    position: Vec3Tuple;
    slot: number;
    stance: string;
    weaponId: string;
    ws: ServerWebSocket<PlayerData>;
};

export type PlayerData = {
    playerId: string | null;
};

type ServerWebSocket<T> = {
    close: () => void;
    data: T;
    send: (data: string) => void;
};

export type Room = {
    broadcast: (msg: ServerMessage, exclude?: string) => void;
    getPlayer: (id: string) => PlayerSlot | undefined;
    getPlayers: () => PlayerSlot[];
    isFull: () => boolean;
    join: (ws: ServerWebSocket<PlayerData>, name: string) => PlayerSlot | null;
    leave: (playerId: string) => void;
    sendTo: (playerId: string, msg: ServerMessage) => void;
};

let nextPlayerId = 1;

export const createRoom = (): Room => {
    const players = new Map<string, PlayerSlot>();

    const findFreeSlot = (): number | null => {
        const taken = new Set<number>();
        for (const p of players.values()) {
            taken.add(p.slot);
        }
        for (let i = 0; i < MAX_PLAYERS; i++) {
            if (!taken.has(i)) {
                return i;
            }
        }
        return null;
    };

    return {
        broadcast: (msg: ServerMessage, exclude?: string) => {
            const raw = encodeMessage(msg);
            for (const player of players.values()) {
                if (player.id !== exclude) {
                    player.ws.send(raw);
                }
            }
        },

        getPlayer: (id: string) => players.get(id),

        getPlayers: () => [...players.values()],

        isFull: () => players.size >= MAX_PLAYERS,

        join: (ws: ServerWebSocket<PlayerData>, name: string) => {
            const slot = findFreeSlot();
            if (slot === null) {
                return null;
            }

            const id = `player_${nextPlayerId++}`;
            ws.data.playerId = id;

            // Spawn at different positions based on slot.
            // Y=1 matches approximate standing height on the ground plane (no Rapier on server).
            const spawnPositions: Vec3Tuple[] = [
                [0, 1, 5],
                [4, 1, 5],
            ];

            const player: PlayerSlot = {
                id,
                lastInputSeq: 0,
                lookRotation: [1, 0, 0, 0],
                name,
                position: spawnPositions[slot] ?? [0, 1, 5],
                slot,
                stance: 'standing',
                weaponId: 'rifle',
                ws,
            };

            players.set(id, player);
            return player;
        },

        leave: (playerId: string) => {
            players.delete(playerId);
        },

        sendTo: (playerId: string, msg: ServerMessage) => {
            const player = players.get(playerId);
            if (player) {
                player.ws.send(encodeMessage(msg));
            }
        },
    };
};
