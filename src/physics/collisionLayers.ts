/**
 * Collision group membership bits.
 * Rapier uses a 32-bit packed value: upper 16 bits = membership, lower 16 bits = filter.
 */
export const CollisionGroup = {
    ENEMY: 0x0004,
    PICKUP: 0x0010,
    PLAYER: 0x0002,
    PROJECTILE: 0x0008,
    TRIGGER: 0x0020,
    WORLD: 0x0001,
} as const;

/**
 * Pack membership and filter into a single 32-bit interaction group value for Rapier.
 * @param membership - which groups this collider belongs to
 * @param filter - which groups this collider interacts with
 */
export const packGroup = (membership: number, filter: number): number => (membership << 16) | filter;

/** Player interacts with world geometry, enemies, projectiles, and triggers. */
export const PLAYER_GROUP = packGroup(
    CollisionGroup.PLAYER,
    CollisionGroup.WORLD | CollisionGroup.ENEMY | CollisionGroup.PROJECTILE | CollisionGroup.TRIGGER,
);

/** Enemies interact with world geometry, the player, and projectiles. */
export const ENEMY_GROUP = packGroup(
    CollisionGroup.ENEMY,
    CollisionGroup.WORLD | CollisionGroup.PLAYER | CollisionGroup.PROJECTILE,
);

/** Projectiles interact with world geometry, the player, and enemies. */
export const PROJECTILE_GROUP = packGroup(
    CollisionGroup.PROJECTILE,
    CollisionGroup.WORLD | CollisionGroup.PLAYER | CollisionGroup.ENEMY,
);

/** Pickups only interact with the player. */
export const PICKUP_GROUP = packGroup(CollisionGroup.PICKUP, CollisionGroup.PLAYER);

/** World geometry interacts with players, enemies, and projectiles. */
export const WORLD_GROUP = packGroup(
    CollisionGroup.WORLD,
    CollisionGroup.PLAYER | CollisionGroup.ENEMY | CollisionGroup.PROJECTILE,
);

/** Triggers only interact with the player. */
export const TRIGGER_GROUP = packGroup(CollisionGroup.TRIGGER, CollisionGroup.PLAYER);
