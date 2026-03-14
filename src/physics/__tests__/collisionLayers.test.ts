import { describe, expect, it } from 'vitest';

import {
    CollisionGroup,
    ENEMY_GROUP,
    PICKUP_GROUP,
    PLAYER_GROUP,
    PROJECTILE_GROUP,
    packGroup,
    TRIGGER_GROUP,
    WORLD_GROUP,
} from '../collisionLayers';

describe('CollisionLayers', () => {
    it('packGroup puts membership in upper 16 bits and filter in lower 16', () => {
        const packed = packGroup(0x0002, 0x0001);
        expect(packed).toBe(0x0002_0001);
    });

    it('packGroup handles zero membership', () => {
        const packed = packGroup(0, 0x000f);
        expect(packed).toBe(0x000f);
    });

    it('player can interact with world', () => {
        const playerFilter = PLAYER_GROUP & 0xffff;
        expect(playerFilter & CollisionGroup.WORLD).toBeTruthy();
    });

    it('player can interact with enemies', () => {
        const playerFilter = PLAYER_GROUP & 0xffff;
        expect(playerFilter & CollisionGroup.ENEMY).toBeTruthy();
    });

    it('player can interact with triggers', () => {
        const playerFilter = PLAYER_GROUP & 0xffff;
        expect(playerFilter & CollisionGroup.TRIGGER).toBeTruthy();
    });

    it('player does not interact with pickups via physics filter', () => {
        const playerFilter = PLAYER_GROUP & 0xffff;
        expect(playerFilter & CollisionGroup.PICKUP).toBe(0);
    });

    it('pickup only collides with player', () => {
        const pickupFilter = PICKUP_GROUP & 0xffff;
        expect(pickupFilter).toBe(CollisionGroup.PLAYER);
    });

    it('enemy interacts with world, player, and projectiles', () => {
        const enemyFilter = ENEMY_GROUP & 0xffff;
        expect(enemyFilter & CollisionGroup.WORLD).toBeTruthy();
        expect(enemyFilter & CollisionGroup.PLAYER).toBeTruthy();
        expect(enemyFilter & CollisionGroup.PROJECTILE).toBeTruthy();
    });

    it('enemy does not interact with triggers or pickups', () => {
        const enemyFilter = ENEMY_GROUP & 0xffff;
        expect(enemyFilter & CollisionGroup.TRIGGER).toBe(0);
        expect(enemyFilter & CollisionGroup.PICKUP).toBe(0);
    });

    it('trigger only collides with player', () => {
        const triggerFilter = TRIGGER_GROUP & 0xffff;
        expect(triggerFilter).toBe(CollisionGroup.PLAYER);
    });

    it('all pre-packed groups have non-zero membership', () => {
        for (const group of [PLAYER_GROUP, ENEMY_GROUP, PROJECTILE_GROUP, PICKUP_GROUP, WORLD_GROUP, TRIGGER_GROUP]) {
            const membership = (group >>> 16) & 0xffff;
            expect(membership).toBeGreaterThan(0);
        }
    });

    it('collision groups are mutually consistent (if A filters B, B filters A)', () => {
        // Player filters ENEMY, ENEMY filters PLAYER
        const playerFilter = PLAYER_GROUP & 0xffff;
        const playerMembership = (PLAYER_GROUP >>> 16) & 0xffff;
        const enemyFilter = ENEMY_GROUP & 0xffff;
        const enemyMembership = (ENEMY_GROUP >>> 16) & 0xffff;

        expect(playerFilter & enemyMembership).toBeTruthy();
        expect(enemyFilter & playerMembership).toBeTruthy();
    });
});
