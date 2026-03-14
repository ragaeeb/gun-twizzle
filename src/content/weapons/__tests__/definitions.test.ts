import { describe, expect, it } from 'vitest';

import { WEAPON_REGISTRY } from '../definitions';

describe('WeaponRegistry', () => {
    it('all weapons have positive damage', () => {
        for (const [id, def] of Object.entries(WEAPON_REGISTRY)) {
            expect(def.damage, `${id} damage`).toBeGreaterThan(0);
        }
    });

    it('all weapons have valid fire rate', () => {
        for (const [id, def] of Object.entries(WEAPON_REGISTRY)) {
            expect(def.fireRateHz, `${id} fireRate`).toBeGreaterThan(0);
        }
    });

    it('all weapons have a type', () => {
        for (const [id, def] of Object.entries(WEAPON_REGISTRY)) {
            expect(['hitscan', 'melee'], `${id} type`).toContain(def.type);
        }
    });

    it('hitscan weapons have positive range', () => {
        for (const [id, def] of Object.entries(WEAPON_REGISTRY)) {
            if (def.type === 'hitscan') {
                expect(def.range, `${id} range`).toBeGreaterThan(0);
            }
        }
    });

    it('all weapons have headshot multiplier >= 1', () => {
        for (const [id, def] of Object.entries(WEAPON_REGISTRY)) {
            expect(def.headshotMultiplier, `${id} headshotMultiplier`).toBeGreaterThanOrEqual(1);
        }
    });
});
