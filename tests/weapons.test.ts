import { describe, expect, it } from 'vitest';
import { WeaponId } from '../src/runtime/types';
import { WeaponRegistry } from '../src/runtime/weapons';

describe('WeaponRegistry', () => {
    it('registers the default weapons', () => {
        WeaponRegistry.initializeWeaponDefinitions();
        const ids = WeaponRegistry.getAllIds();

        expect(ids).toContain(WeaponId.AK47);
        expect(ids).toContain(WeaponId.USP);
        expect(ids).toContain(WeaponId.KNIFE);
    });
});
