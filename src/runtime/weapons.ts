import { AssetRegistry } from '../assets/registry';
import type { WeaponDefinition, WeaponId as WeaponIdType } from './types';
import { WeaponId } from './types';

const weaponDefinitions = new Map<WeaponIdType, WeaponDefinition>();

function registerWeapon(definition: WeaponDefinition) {
    weaponDefinitions.set(definition.id, definition);
}

function initializeWeaponDefinitions() {
    weaponDefinitions.clear();

    registerWeapon({
        hudImagePath: AssetRegistry.hud.ak47,
        id: WeaponId.AK47,
        markerPath: AssetRegistry.weapons.ak47.markers,
        modelPath: AssetRegistry.weapons.ak47.model,
        modelPosition: [-0.03, -1.02, -0.12],
        modelRotation: [0, Math.PI, 0],
        modelScale: 0.66,
        name: 'AK-47',
        shootParticleOffset: { x: -0.01, y: -0.015, z: -0.55 },
        shootSoundKey: 'gunshot2',
        stats: {
            accuracy: 0.8,
            damage: 35,
            fireRate: 600,
            magazineSize: 100,
            range: 1000,
            reloadTime: 2,
            totalAmmo: 1200,
            weaponType: 'rifle',
        },
    });

    registerWeapon({
        hudImagePath: AssetRegistry.hud.usp,
        id: WeaponId.USP,
        markerPath: AssetRegistry.weapons.usp.markers,
        modelPath: AssetRegistry.weapons.usp.model,
        modelPosition: [0.04, -0.2, -0.28],
        modelRotation: [0.1, Math.PI - 0.18, 0.1],
        modelScale: 0.72,
        name: 'USP',
        shootParticleOffset: { x: 0.004, y: -0.04, z: -0.5 },
        shootSoundKey: 'gunshot',
        stats: {
            accuracy: 0.9,
            damage: 25,
            fireRate: 300,
            magazineSize: 12,
            range: 1000,
            reloadTime: 1.5,
            totalAmmo: 60,
            weaponType: 'pistol',
        },
    });

    registerWeapon({
        hudImagePath: AssetRegistry.hud.knife,
        id: WeaponId.KNIFE,
        markerPath: AssetRegistry.weapons.knife.markers,
        modelPath: AssetRegistry.weapons.knife.model,
        modelPosition: [0.1, -0.12, -0.28],
        modelRotation: [0.05, Math.PI - 0.15, 0.08],
        modelScale: 0.009,
        name: 'Knife',
        shootSoundKey: 'knife',
        stats: {
            accuracy: 1,
            damage: 50,
            fireRate: 300,
            magazineSize: 0,
            range: 5,
            reloadTime: 0,
            totalAmmo: 0,
            weaponType: 'knife',
        },
    });
}

export const WeaponRegistry = {
    exists(id: WeaponIdType) {
        return weaponDefinitions.has(id);
    },
    get(id: WeaponIdType) {
        return weaponDefinitions.get(id);
    },
    getAll() {
        return Array.from(weaponDefinitions.values());
    },
    getAllIds() {
        return Array.from(weaponDefinitions.keys());
    },
    initializeWeaponDefinitions,
};
