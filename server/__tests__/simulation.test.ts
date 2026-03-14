import { describe, expect, it, vi } from 'vitest';

import { LEVEL_1 } from '../../src/content/levels/level1';
import type { SerializedInput } from '../../src/net/protocol';
import { createRoom } from '../room';
import { createServerSimulation } from '../simulation';

const createInput = (overrides: Partial<SerializedInput> = {}): SerializedInput => ({
    backward: false,
    cameraPosition: null,
    crouch: false,
    forward: false,
    jump: false,
    left: false,
    lookRotation: [1, 0, 0, 0],
    reload: false,
    right: false,
    shoot: false,
    sprint: false,
    switchWeapon: null,
    ...overrides,
});

describe('server simulation input validation', () => {
    it('rejects suspicious camera position jumps', () => {
        const room = createRoom();
        const ws = { close: vi.fn(), data: { playerId: null }, send: vi.fn() };
        const slot = room.join(ws, 'Player');
        expect(slot).not.toBeNull();
        if (!slot) {
            return;
        }

        const sim = createServerSimulation(LEVEL_1, room);
        sim.registerPlayer(slot);

        const initial = slot.position;

        sim.applyInput(slot.id, createInput({ cameraPosition: [1000, 1000, 1000] }), 1);

        const snapshot = sim.getSnapshot();
        const player = snapshot.players.find((p) => p.id === slot.id);
        expect(player).toBeTruthy();
        if (!player) {
            return;
        }

        const dist = Math.hypot(
            player.position[0] - initial[0],
            player.position[1] - initial[1],
            player.position[2] - initial[2],
        );
        expect(dist).toBeLessThan(1);
    });

    it('accepts camera positions within movement bounds', () => {
        const room = createRoom();
        const ws = { close: vi.fn(), data: { playerId: null }, send: vi.fn() };
        const slot = room.join(ws, 'Player');
        expect(slot).not.toBeNull();
        if (!slot) {
            return;
        }

        const sim = createServerSimulation(LEVEL_1, room);
        sim.registerPlayer(slot);

        const initial = slot.position;
        const newX = initial[0] + 0.2;
        const newZ = initial[2];
        const cameraY = initial[1] + 1.5;

        sim.applyInput(slot.id, createInput({ cameraPosition: [newX, cameraY, newZ] }), 2);

        const snapshot = sim.getSnapshot();
        const player = snapshot.players.find((p) => p.id === slot.id);
        expect(player).toBeTruthy();
        if (!player) {
            return;
        }

        expect(player.position[0]).toBeCloseTo(newX, 5);
        expect(player.position[1]).toBeCloseTo(initial[1], 5);
        expect(player.position[2]).toBeCloseTo(newZ, 5);
    });
});
