/**
 * Gun Twizzle — Bun WebSocket game server.
 *
 * Runs the headless simulation at 60Hz and broadcasts state to connected clients.
 * Start with: bun run server/main.ts
 *
 * Environment:
 *   PORT           — server port (default 3001)
 *   LEVEL_ID       — which level to load (default "level1")
 */

import { LEVEL_1 } from '../src/content/levels/level1';
import { LEVEL_2 } from '../src/content/levels/level2';
import { LEVEL_3 } from '../src/content/levels/level3';
import { LEVEL_4 } from '../src/content/levels/level4';
import type { LevelDef } from '../src/content/levels/types';
import { decodeClientMessage } from '../src/net/protocol';
import { createRoom, type PlayerData } from './room';
import { createServerSimulation } from './simulation';

const PORT = Number(process.env.PORT ?? 3001);
const LEVEL_ID = process.env.LEVEL_ID ?? 'level1';
const TICK_HZ = 60;
const SNAPSHOT_INTERVAL = 3; // broadcast every Nth tick

const LEVELS: Record<string, LevelDef> = {
    level1: LEVEL_1,
    level2: LEVEL_2,
    level3: LEVEL_3,
    level4: LEVEL_4,
};

const levelDef = LEVELS[LEVEL_ID];
if (!levelDef) {
    console.error(`Unknown level: ${LEVEL_ID}. Available: ${Object.keys(LEVELS).join(', ')}`);
    process.exit(1);
}

const room = createRoom();
const sim = createServerSimulation(levelDef, room);
let tickCounter = 0;

// ─── Tick loop ──────────────────────────────────────────────────────────

const tickInterval = setInterval(() => {
    sim.tick();
    tickCounter += 1;

    // Broadcast snapshot at reduced rate to save bandwidth
    if (tickCounter % SNAPSHOT_INTERVAL === 0) {
        const snapshot = sim.getSnapshot();
        const lastInputSeq: Record<string, number> = {};
        for (const player of room.getPlayers()) {
            lastInputSeq[player.id] = player.lastInputSeq;
        }

        room.broadcast({
            lastInputSeq,
            snapshot,
            tick: tickCounter,
            type: 's:snapshot',
        });
    }
}, 1000 / TICK_HZ);

// ─── HTTP + WebSocket server ────────────────────────────────────────────

const server = Bun.serve<PlayerData>({
    fetch(req, server) {
        const upgraded = server.upgrade(req, {
            data: { playerId: null } satisfies PlayerData,
        });
        if (upgraded) {
            return undefined;
        }
        return new Response(`Gun Twizzle Server — ${levelDef.name} (tick ${tickCounter})`, {
            status: 200,
        });
    },
    idleTimeout: 120,
    port: PORT,

    websocket: {
        close(ws) {
            const playerId = ws.data.playerId;
            if (playerId) {
                sim.removePlayer(playerId);
                room.leave(playerId);
                room.broadcast({ playerId, type: 's:playerLeave' });
                console.log(`[ws] ${playerId} disconnected`);
            }
        },

        message(ws, data) {
            if (typeof data !== 'string') {
                return;
            }

            try {
                const msg = decodeClientMessage(data);

                switch (msg.type) {
                    case 'c:join': {
                        if (room.isFull()) {
                            ws.send(JSON.stringify({ message: 'Room is full', type: 'error' }));
                            ws.close();
                            return;
                        }

                        // Reset the level when first player joins an empty room
                        if (room.getPlayers().length === 0) {
                            sim.reset();
                        }

                        const slot = room.join(ws, msg.name);
                        if (!slot) {
                            ws.send(JSON.stringify({ message: 'Failed to join', type: 'error' }));
                            ws.close();
                            return;
                        }

                        sim.registerPlayer(slot);

                        // Send welcome to the joining player
                        room.sendTo(slot.id, {
                            levelId: levelDef.id,
                            playerId: slot.id,
                            snapshot: sim.getSnapshot(),
                            tick: tickCounter,
                            type: 's:welcome',
                        });

                        // Notify others
                        room.broadcast(
                            {
                                playerId: slot.id,
                                slot: slot.slot,
                                type: 's:playerJoin',
                            },
                            slot.id,
                        );

                        console.log(`[ws] ${slot.name} joined as ${slot.id} (slot ${slot.slot})`);
                        break;
                    }

                    case 'c:input': {
                        const playerId = ws.data.playerId;
                        if (!playerId) {
                            return;
                        }
                        sim.applyInput(playerId, msg.input, msg.seq);
                        break;
                    }
                }
            } catch (err) {
                console.error('[ws] failed to parse message:', err);
            }
        },
        open(_ws) {
            console.log('[ws] connection opened');
        },
    },
});

console.log(`🔫 Gun Twizzle server running on ws://localhost:${PORT}`);
console.log(`   Level: ${levelDef.name} (${LEVEL_ID})`);
console.log(`   Tick rate: ${TICK_HZ}Hz, snapshot every ${SNAPSHOT_INTERVAL} ticks`);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    clearInterval(tickInterval);
    sim.destroy();
    server.stop();
    process.exit(0);
});
