import { AssetRegistry } from '../../assets/registry';

export type WeaponDef = {
    damage: number;
    falloffEnd: number;
    falloffMinDamage: number;
    falloffStart: number;
    fireRateHz: number;
    headshotMultiplier: number;
    id: string;
    magazineSize: number;
    modelPath: string;
    name: string;
    range: number;
    reserveAmmo: number;
    reloadDurationMs: number;
    sfx: {
        draw: string;
        empty: string;
        reload: string;
        shoot: string;
    };
    spreadAngleDeg: number;
    type: 'hitscan' | 'melee';
};

export const WEAPON_REGISTRY: Record<string, WeaponDef> = {
    knife: {
        damage: 55,
        falloffEnd: 0,
        falloffMinDamage: 55,
        falloffStart: 0,
        fireRateHz: 2,
        headshotMultiplier: 1.0,
        id: 'knife',
        magazineSize: 1,
        modelPath: AssetRegistry.weapons.knife.model,
        name: 'Knife',
        range: 2.5,
        reloadDurationMs: 0,
        reserveAmmo: 0,
        sfx: {
            draw: AssetRegistry.sounds.draw3,
            empty: '',
            reload: '',
            shoot: AssetRegistry.sounds.knife,
        },
        spreadAngleDeg: 0,
        type: 'melee',
    },
    rifle: {
        damage: 28,
        falloffEnd: 120,
        falloffMinDamage: 14,
        falloffStart: 40,
        fireRateHz: 10,
        headshotMultiplier: 2.0,
        id: 'rifle',
        magazineSize: 30,
        modelPath: AssetRegistry.weapons.ak47.model,
        name: 'AK-47',
        range: 200,
        reloadDurationMs: 2400,
        reserveAmmo: 90,
        sfx: {
            draw: AssetRegistry.sounds.draw,
            empty: AssetRegistry.sounds.tac,
            reload: AssetRegistry.sounds.clip,
            shoot: AssetRegistry.sounds.gunshot,
        },
        spreadAngleDeg: 1.5,
        type: 'hitscan',
    },
};
