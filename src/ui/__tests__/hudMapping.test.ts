import { describe, expect, it } from 'vitest';

import type { HudState } from '../../runtime/types';
import { computeAmmoRatio } from '../Hud';
import { clamp01, getAmmoColor, getHealthColor } from '../utils/hudColorMapping';

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
        const ratio = computeAmmoRatio(state.ammo, state.magazineSize);
        expect(ratio).toBe(0.5);
    });

    it('returns 1 when magazine size is zero (knife)', () => {
        const state = createHudState({ ammo: 0, magazineSize: 0 });
        const ratio = computeAmmoRatio(state.ammo, state.magazineSize);
        expect(ratio).toBe(1);
    });

    it('maps health ratio to correct color bands', () => {
        expect(getHealthColor(clamp01(100 / 100))).toBe('#44FF44');
        expect(getHealthColor(clamp01(50 / 100))).toBe('#FFD700');
        expect(getHealthColor(clamp01(20 / 100))).toBe('#FF4444');
    });

    it('maps ammo ratio to correct color bands', () => {
        expect(getAmmoColor(clamp01(20 / 30))).toBe('#FFFFFF');
        expect(getAmmoColor(clamp01(10 / 30))).toBe('#FFD700');
        expect(getAmmoColor(clamp01(2 / 30))).toBe('#FF6B6B');
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
