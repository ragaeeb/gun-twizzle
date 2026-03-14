import type { WeaponDef } from '../../content/weapons/definitions';
import type { DamageEvent } from '../events';
import type { EntityId } from '../world';

export type HitScanInput = {
    distance: number;
    hitEntityId: EntityId | null;
    hitNormal: { x: number; y: number; z: number };
    hitPoint: { x: number; y: number; z: number };
    isHeadshot: boolean;
};

/**
 * Calculate damage from a hitscan result with distance falloff.
 * Returns a DamageEvent if the hit is valid, null otherwise.
 */
export const processHitScanResult = (hit: HitScanInput, weaponDef: WeaponDef): DamageEvent | null => {
    if (!hit.hitEntityId) {
        return null;
    }

    let damage = weaponDef.damage;

    // Apply distance falloff for hitscan weapons
    if (weaponDef.type === 'hitscan' && weaponDef.falloffStart > 0) {
        const falloffRange = weaponDef.falloffEnd - weaponDef.falloffStart;
        if (hit.distance > weaponDef.falloffEnd) {
            damage = weaponDef.falloffMinDamage;
        } else if (hit.distance > weaponDef.falloffStart && falloffRange > 0) {
            const t = (hit.distance - weaponDef.falloffStart) / falloffRange;
            damage = weaponDef.damage + t * (weaponDef.falloffMinDamage - weaponDef.damage);
        }
    }

    return {
        amount: damage,
        hitNormal: { ...hit.hitNormal },
        hitPoint: { ...hit.hitPoint },
        isHeadshot: hit.isHeadshot,
        targetId: hit.hitEntityId,
        type: 'damage',
    };
};
