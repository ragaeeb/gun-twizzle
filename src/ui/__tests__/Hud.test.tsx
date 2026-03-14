/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { HudState } from '../../runtime/types';
import { Hud } from '../Hud';

const defaultState: HudState = {
    ammo: 25,
    health: 80,
    healthMax: 100,
    hudImage: '/weapons/ak47.webp',
    isReloading: false,
    magazineSize: 30,
    missionText: '',
    totalAmmo: 90,
    weaponId: null,
    weaponName: 'AK-47',
};

afterEach(cleanup);

describe('Hud component', () => {
    it('displays ammo count correctly', () => {
        render(<Hud state={defaultState} />);
        expect(screen.getByText('25')).toBeDefined();
        expect(screen.getByText('90')).toBeDefined();
    });

    it('displays weapon name', () => {
        render(<Hud state={defaultState} />);
        expect(screen.getByText('AK-47')).toBeDefined();
    });

    it('displays health value', () => {
        render(<Hud state={{ ...defaultState, health: 73 }} />);
        expect(screen.getByText('73 HP')).toBeDefined();
    });

    it('shows reload indicator when reloading', () => {
        render(<Hud state={{ ...defaultState, isReloading: true }} />);
        const reloadEl = screen.getByText('Reloading');
        expect(reloadEl.classList.contains('visible')).toBe(true);
    });

    it('hides reload indicator when not reloading', () => {
        render(<Hud state={{ ...defaultState, isReloading: false }} />);
        const reloadEl = screen.getByText('Reloading');
        expect(reloadEl.classList.contains('visible')).toBe(false);
    });

    it('shows mission text when present', () => {
        render(<Hud state={{ ...defaultState, missionText: 'Eliminate hostiles: 2/3' }} />);
        expect(screen.getByText('Eliminate hostiles: 2/3')).toBeDefined();
    });

    it('hides mission text when empty', () => {
        render(<Hud state={{ ...defaultState, missionText: '' }} />);
        expect(screen.queryByText('Eliminate hostiles')).toBeNull();
    });

    it('applies red color for low health', () => {
        const { container } = render(<Hud state={{ ...defaultState, health: 15, healthMax: 100 }} />);
        const healthText = container.querySelector('.health-text');
        const style = healthText?.getAttribute('style') ?? '';
        expect(style).toMatch(/255,\s*68,\s*68|#FF4444/i);
    });

    it('applies green color for high health', () => {
        const { container } = render(<Hud state={{ ...defaultState, health: 90, healthMax: 100 }} />);
        const healthText = container.querySelector('.health-text');
        const style = healthText?.getAttribute('style') ?? '';
        expect(style).toMatch(/68,\s*255,\s*68|#44FF44/i);
    });

    it('applies yellow color for medium ammo', () => {
        const { container } = render(<Hud state={{ ...defaultState, ammo: 10, magazineSize: 30 }} />);
        const ammoCurrent = container.querySelector('.weapon-ammo-current');
        const style = ammoCurrent?.getAttribute('style') ?? '';
        expect(style).toMatch(/255,\s*215,\s*0|#FFD700/i);
    });

    it('applies red color for low ammo', () => {
        const { container } = render(<Hud state={{ ...defaultState, ammo: 3, magazineSize: 30 }} />);
        const ammoCurrent = container.querySelector('.weapon-ammo-current');
        const style = ammoCurrent?.getAttribute('style') ?? '';
        expect(style).toMatch(/255,\s*107,\s*107|#FF6B6B/i);
    });

    it('renders crosshair lines', () => {
        const { container } = render(<Hud state={defaultState} />);
        const crosshairLines = container.querySelectorAll('.crosshair-line');
        expect(crosshairLines.length).toBe(4);
    });

    it('renders weapon HUD image with alt text', () => {
        render(<Hud state={defaultState} />);
        const img = screen.getByAltText('AK-47');
        expect(img).toBeDefined();
        expect(img.getAttribute('src')).toBe('/weapons/ak47.webp');
    });
});
