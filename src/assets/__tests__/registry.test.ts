import { describe, expect, it } from 'vitest';

import { AssetRegistry } from '../registry';

describe('AssetRegistry', () => {
    it('all weapon entries have model paths', () => {
        for (const [name, entry] of Object.entries(AssetRegistry.weapons)) {
            expect(entry.model, `${name} missing model`).toBeDefined();
            expect(typeof entry.model).toBe('string');
        }
    });

    it('all HUD entries have image paths', () => {
        for (const [name, path] of Object.entries(AssetRegistry.hud)) {
            expect(path, `${name} missing HUD image`).toBeDefined();
            expect(typeof path).toBe('string');
        }
    });

    it('all sound entries have paths', () => {
        for (const [name, path] of Object.entries(AssetRegistry.sounds)) {
            expect(path, `${name} missing sound path`).toBeDefined();
            expect(typeof path).toBe('string');
        }
    });

    it('all texture entries have paths', () => {
        for (const [name, path] of Object.entries(AssetRegistry.textures)) {
            expect(path, `${name} missing texture path`).toBeDefined();
            expect(typeof path).toBe('string');
        }
    });

    it('all pickup entries have paths', () => {
        for (const [name, path] of Object.entries(AssetRegistry.pickups)) {
            expect(path, `${name} missing pickup path`).toBeDefined();
            expect(typeof path).toBe('string');
        }
    });
});
