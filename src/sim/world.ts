export type EntityId = number;

export type ComponentStore<T> = {
    /** Remove an entity's component. */
    delete: (id: EntityId) => void;
    /** Yields only populated entries. Callers must not assume dense iteration. */
    entries: () => Iterable<[EntityId, T]>;
    /** Get an entity's component, or undefined if not present. */
    get: (id: EntityId) => T | undefined;
    /** Check if an entity has this component. */
    has: (id: EntityId) => boolean;
    /** Set an entity's component value. */
    set: (id: EntityId, value: T) => void;
};

/** Create a Map-backed component store. Swap backend later if profiling justifies it. */
export const createComponentStore = <T>(): ComponentStore<T> => {
    const map = new Map<EntityId, T>();

    return {
        delete: (id) => {
            map.delete(id);
        },
        entries: () => map.entries(),
        get: (id) => map.get(id),
        has: (id) => map.has(id),
        set: (id, value) => {
            map.set(id, value);
        },
    };
};

export type TransformComponent = {
    position: { x: number; y: number; z: number };
    rotation: { w: number; x: number; y: number; z: number };
};

export type HealthComponent = {
    current: number;
    max: number;
    shieldCurrent: number;
    shieldMax: number;
    shieldRechargeDelay: number;
};

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

export type AIComponent = {
    attackCooldown: number;
    enemyDefId: string;
    patrolIndex: number;
    patrolPath: Array<{ x: number; y: number; z: number }>;
    state: AIState;
    targetEntityId: EntityId | null;
};

export type WeaponOwnerComponent = {
    ammo: Record<string, { magazine: number; reserve: number }>;
    equippedWeaponId: string;
};

export type PickupComponent = {
    pickupId: string;
    respawnAt: number | null;
};

export type StatusEffectType = 'shield_regen' | 'speed_boost' | 'damage_boost' | 'golden_gun';

export type StatusEffectComponent = {
    effects: Array<{
        id: string;
        magnitude: number;
        remainingDuration: number;
        type: StatusEffectType;
    }>;
};

export type World = {
    ai: ComponentStore<AIComponent>;
    health: ComponentStore<HealthComponent>;
    nextId: EntityId;
    pickup: ComponentStore<PickupComponent>;
    statusEffects: ComponentStore<StatusEffectComponent>;
    tags: ComponentStore<Set<string>>;
    transform: ComponentStore<TransformComponent>;
    weaponOwner: ComponentStore<WeaponOwnerComponent>;
};

export const createWorld = (): World => ({
    ai: createComponentStore(),
    health: createComponentStore(),
    nextId: 1,
    pickup: createComponentStore(),
    statusEffects: createComponentStore(),
    tags: createComponentStore(),
    transform: createComponentStore(),
    weaponOwner: createComponentStore(),
});

export const createEntity = (world: World): EntityId => {
    const id = world.nextId;
    world.nextId += 1;
    return id;
};

export const destroyEntity = (world: World, id: EntityId): void => {
    world.transform.delete(id);
    world.health.delete(id);
    world.tags.delete(id);
    world.ai.delete(id);
    world.pickup.delete(id);
    world.statusEffects.delete(id);
    world.weaponOwner.delete(id);
};

export const addTag = (world: World, id: EntityId, tag: string): void => {
    let tags = world.tags.get(id);

    if (!tags) {
        tags = new Set();
        world.tags.set(id, tags);
    }

    tags.add(tag);
};

export const hasTag = (world: World, id: EntityId, tag: string): boolean => {
    return world.tags.get(id)?.has(tag) ?? false;
};

export const getEntitiesWithTag = (world: World, tag: string): EntityId[] => {
    const result: EntityId[] = [];

    for (const [id, tags] of world.tags.entries()) {
        if (tags.has(tag)) {
            result.push(id);
        }
    }

    return result;
};
