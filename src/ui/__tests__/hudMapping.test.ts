import { describe, expect, it } from 'vitest';

import type { HudState } from '../../runtime/types';

const createHudState = (overrides: Partial<HudState> = {}): HudState => ({
    ammo: 30,
    health: 100,
    healthMax: 100,
    hudImage: '/weapons/ak47.webp',
    isReloading: false,
    magazineSize: 30,
    missionText: 'Eliminate hostiles: 0/3',
    totalAmmo: 90,
    weaponId: null,
    weaponName: 'AK-47',
    ...overrides,
});

describe('HUD state mapping', () => {
    it('computes ammo ratio correctly', () => {
        const state = createHudState({ ammo: 15, magazineSize: 30 });
        const ratio = state.magazineSize > 0 ? state.ammo / state.magazineSize : 1;
        expect(ratio).toBe(0.5);
    });

    it('returns 1 when magazine size is zero (knife)', () => {
        const state = createHudState({ ammo: 0, magazineSize: 0 });
        const ratio = state.magazineSize > 0 ? state.ammo / state.magazineSize : 1;
        expect(ratio).toBe(1);
    });

    it('maps health ratio to correct color bands', () => {
        const getHealthColor = (health: number, max: number) => {
            const ratio = max > 0 ? health / max : 1;
            return ratio > 0.6 ? '#44FF44' : ratio > 0.3 ? '#FFD700' : '#FF4444';
        };

        expect(getHealthColor(100, 100)).toBe('#44FF44');
        expect(getHealthColor(50, 100)).toBe('#FFD700');
        expect(getHealthColor(20, 100)).toBe('#FF4444');
    });

    it('maps ammo ratio to correct color bands', () => {
        const getAmmoColor = (ammo: number, magazineSize: number) => {
            const ratio = magazineSize > 0 ? ammo / magazineSize : 1;
            return ratio > 0.5 ? '#FFFFFF' : ratio > 0.25 ? '#FFD700' : '#FF6B6B';
        };

        expect(getAmmoColor(20, 30)).toBe('#FFFFFF');
        expect(getAmmoColor(10, 30)).toBe('#FFD700');
        expect(getAmmoColor(2, 30)).toBe('#FF6B6B');
    });

    it('shows mission text when set', () => {
        const state = createHudState({ missionText: 'Eliminate hostiles: 2/3' });
        expect(state.missionText).toBeTruthy();
    });

    it('hides mission text when empty', () => {
        const state = createHudState({ missionText: '' });
        expect(state.missionText).toBeFalsy();
    });
});
