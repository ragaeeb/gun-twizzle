import { describe, expect, it } from 'vitest';
import type { ClientMessage, ServerMessage } from '../protocol';
import { decodeClientMessage, decodeServerMessage, encodeMessage } from '../protocol';

describe('protocol encoding/decoding', () => {
    it('round-trips a client join message', () => {
        const msg: ClientMessage = { name: 'TestPlayer', type: 'c:join' };
        const encoded = encodeMessage(msg);
        const decoded = decodeClientMessage(encoded);

        expect(decoded.type).toBe('c:join');
        if (decoded.type === 'c:join') {
            expect(decoded.name).toBe('TestPlayer');
        }
    });

    it('round-trips a client input message', () => {
        const msg: ClientMessage = {
            input: {
                backward: false,
                cameraPosition: [0, 0, 0],
                crouch: false,
                forward: true,
                jump: false,
                left: false,
                lookRotation: [1, 0, 0, 0],
                reload: false,
                right: true,
                shoot: true,
                sprint: false,
                switchWeapon: null,
            },
            seq: 42,
            type: 'c:input',
        };
        const encoded = encodeMessage(msg);
        const decoded = decodeClientMessage(encoded);

        expect(decoded.type).toBe('c:input');
        if (decoded.type === 'c:input') {
            expect(decoded.seq).toBe(42);
            expect(decoded.input.forward).toBe(true);
            expect(decoded.input.shoot).toBe(true);
            expect(decoded.input.lookRotation).toEqual([1, 0, 0, 0]);
        }
    });

    it('round-trips a server welcome message', () => {
        const msg: ServerMessage = {
            levelId: 'level1',
            playerId: 'player_1',
            snapshot: {
                enemies: [],
                pickups: [],
                players: [
                    {
                        health: 100,
                        id: 'player_1',
                        position: [0, 5, 5],
                        rotation: [1, 0, 0, 0],
                        stance: 'standing',
                        weaponId: 'rifle',
                    },
                ],
            },
            tick: 100,
            type: 's:welcome',
        };
        const encoded = encodeMessage(msg);
        const decoded = decodeServerMessage(encoded);

        expect(decoded.type).toBe('s:welcome');
        if (decoded.type === 's:welcome') {
            expect(decoded.playerId).toBe('player_1');
            expect(decoded.snapshot.players).toHaveLength(1);
        }
    });

    it('round-trips a server hit confirm message', () => {
        const msg: ServerMessage = {
            damage: 56,
            isHeadshot: true,
            shooterId: 'player_1',
            targetId: 5,
            type: 's:hitConfirm',
        };
        const encoded = encodeMessage(msg);
        const decoded = decodeServerMessage(encoded);

        expect(decoded.type).toBe('s:hitConfirm');
        if (decoded.type === 's:hitConfirm') {
            expect(decoded.shooterId).toBe('player_1');
            expect(decoded.damage).toBe(56);
            expect(decoded.isHeadshot).toBe(true);
        }
    });
});
