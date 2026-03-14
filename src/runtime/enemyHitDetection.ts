import type { WeaponDef } from '../content/weapons/definitions';
import { WEAPON_REGISTRY } from '../content/weapons/definitions';
import type { HitScanInput } from '../sim/systems/hitScanSystem';
import type { World } from '../sim/world';
import { getEntitiesWithTag } from '../sim/world';
import type { WeaponId as GameWeaponId } from './types';

type Vec3 = { x: number; y: number; z: number };

const ENEMY_BODY_RADIUS = 0.6;
const ENEMY_HEIGHT = 2.3;
const HEADSHOT_Y_THRESHOLD = 1.7;
const KNIFE_SWEEP_RADIUS = 1.1;
const EPSILON = 1e-6;

const add = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const normalize = (value: Vec3): Vec3 | null => {
    const length = Math.hypot(value.x, value.y, value.z);
    if (length <= EPSILON) {
        return null;
    }

    return {
        x: value.x / length,
        y: value.y / length,
        z: value.z / length,
    };
};

const scale = (value: Vec3, factor: number): Vec3 => ({
    x: value.x * factor,
    y: value.y * factor,
    z: value.z * factor,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
});

const raySphereIntersectionDistance = (
    origin: Vec3,
    direction: Vec3,
    center: Vec3,
    radius: number,
    maxDistance: number,
): number | null => {
    const oc = subtract(origin, center);
    const a = dot(direction, direction);
    const b = 2 * dot(oc, direction);
    const c = dot(oc, oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return null;
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const nearDistance = (-b - sqrtDiscriminant) / (2 * a);
    const farDistance = (-b + sqrtDiscriminant) / (2 * a);
    const distance = nearDistance >= 0 ? nearDistance : farDistance >= 0 ? farDistance : null;

    if (distance === null || distance > maxDistance) {
        return null;
    }

    return distance;
};

const createHit = (
    enemyBaseY: number,
    enemyCenter: Vec3,
    entityId: number,
    origin: Vec3,
    direction: Vec3,
    distance: number,
    canHeadshot: boolean,
): HitScanInput => {
    const hitPoint = add(origin, scale(direction, distance));
    const hitNormal = normalize(subtract(hitPoint, enemyCenter)) ?? { x: 0, y: 0, z: 1 };

    return {
        distance,
        hitEntityId: entityId,
        hitNormal,
        hitPoint,
        isHeadshot: canHeadshot && hitPoint.y > enemyBaseY + HEADSHOT_Y_THRESHOLD,
    };
};

const findClosestHit = (
    world: World,
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
    targetRadius: number,
    canHeadshot: boolean,
): HitScanInput | null => {
    let closestHit: HitScanInput | null = null;

    for (const entityId of getEntitiesWithTag(world, 'enemy')) {
        const ai = world.ai.get(entityId);
        const health = world.health.get(entityId);
        const transform = world.transform.get(entityId);

        if (!ai || !health || !transform || ai.state === 'dead' || health.current <= 0) {
            continue;
        }

        const enemyCenter = {
            x: transform.position.x,
            y: transform.position.y + ENEMY_HEIGHT / 2,
            z: transform.position.z,
        };
        const toEnemy = subtract(enemyCenter, origin);
        if (dot(toEnemy, direction) < -targetRadius) {
            continue;
        }

        const distance = raySphereIntersectionDistance(origin, direction, enemyCenter, targetRadius, maxDistance);
        if (distance === null || (closestHit && distance >= closestHit.distance)) {
            continue;
        }

        closestHit = createHit(transform.position.y, enemyCenter, entityId, origin, direction, distance, canHeadshot);
    }

    return closestHit;
};

export const getSimWeaponDefForGameWeapon = (weaponId: GameWeaponId): WeaponDef => {
    const weaponDef = WEAPON_REGISTRY[weaponId.toLowerCase()];
    if (!weaponDef) {
        throw new Error(`Missing simulation weapon definition for "${weaponId}".`);
    }
    return weaponDef;
};

export const findClosestEnemyHit = (
    world: World,
    origin: Vec3,
    direction: Vec3,
    weaponId: GameWeaponId,
): HitScanInput | null => {
    const normalizedDirection = normalize(direction);
    if (!normalizedDirection) {
        return null;
    }

    const weaponDef = getSimWeaponDefForGameWeapon(weaponId);
    const targetRadius = weaponDef.type === 'melee' ? KNIFE_SWEEP_RADIUS : ENEMY_BODY_RADIUS;
    const canHeadshot = weaponDef.type === 'hitscan';

    return findClosestHit(world, origin, normalizedDirection, weaponDef.range, targetRadius, canHeadshot);
};
