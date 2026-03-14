import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAYER_CONFIG } from '../characterController';

describe('CharacterController', () => {
    describe('DEFAULT_PLAYER_CONFIG', () => {
        it('has reasonable defaults', () => {
            expect(DEFAULT_PLAYER_CONFIG.height).toBe(1.8);
            expect(DEFAULT_PLAYER_CONFIG.radius).toBe(0.3);
            expect(DEFAULT_PLAYER_CONFIG.maxSlopeAngleDeg).toBe(45);
            expect(DEFAULT_PLAYER_CONFIG.autoStepMaxHeight).toBe(0.3);
            expect(DEFAULT_PLAYER_CONFIG.autoStepMinWidth).toBe(0.2);
            expect(DEFAULT_PLAYER_CONFIG.snapToGroundDistance).toBe(0.1);
        });

        it('capsule half-height is positive', () => {
            const halfHeight = DEFAULT_PLAYER_CONFIG.height / 2 - DEFAULT_PLAYER_CONFIG.radius;
            expect(halfHeight).toBeGreaterThan(0);
        });

        it('radius is less than half height', () => {
            expect(DEFAULT_PLAYER_CONFIG.radius).toBeLessThan(DEFAULT_PLAYER_CONFIG.height / 2);
        });
    });
});
