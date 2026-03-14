/**
 * Server-side simulation — runs the headless ECS world at a fixed tick rate.
 * Imports directly from src/sim/ (framework-free, no Three.js).
 *
 * Player movement uses a simplified kinematic model (no Rapier).
 * Combat, AI, and missions are fully authoritative.
 */

import { ENEMY_REGISTRY } from '../src/content/enemies/definitions';
import type { LevelDef } from '../src/content/levels/types';
import { WEAPON_REGISTRY } from '../src/content/weapons/definitions';
import type {
    EnemySnapshot,
    PickupSnapshot,
    PlayerSnapshot,
    QuatTuple,
    SerializedInput,
    WorldSnapshot,
} from '../src/net/protocol';
import { createClock, type SimClock } from '../src/sim/clock';
import type { DamageEvent, EventQueue, SimEvent } from '../src/sim/events';
import { createEventQueue, swapEventBuffers } from '../src/sim/events';
import { aiSystem } from '../src/sim/systems/aiSystem';
import { applyDamageSystem } from '../src/sim/systems/damageSystem';
import { createMissionState, type MissionState, missionSystem } from '../src/sim/systems/missionSystem';
import { pickupSystem } from '../src/sim/systems/pickupSystem';
import { spawnEnemy } from '../src/sim/systems/spawnSystem';
import { applyShieldRegen, statusEffectSystem } from '../src/sim/systems/statusEffectSystem';
import type { EntityId, TransformComponent, World } from '../src/sim/world';
import { addTag, createEntity, createWorld, destroyEntity, getEntitiesWithTag } from '../src/sim/world';
import type { PlayerSlot, Room } from './room';

const TICK_HZ = 60;
const PLAYER_SPEED = 12;
const SPRINT_MULTIPLIER = 1.5;
const CROUCH_MULTIPLIER = 0.5;
const PLAYER_GROUND_Y = 1.0;
const PLAYER_EYE_Y_OFFSET = 1.5;
const ENEMY_RADIUS = 0.6;
const ENEMY_CENTER_Y_OFFSET = 1.15;
const HEADSHOT_Y_THRESHOLD = 1.7;
const HIT_RANGE = 200;
const BASE_DAMAGE = 28;

export type ServerSimulation = {
    applyInput: (playerId: string, input: SerializedInput, seq: number) => void;
    destroy: () => void;
    getSnapshot: () => WorldSnapshot;
    registerPlayer: (slot: PlayerSlot) => void;
    removePlayer: (playerId: string) => void;
    reset: () => void;
    tick: () => void;
    tickCount: () => number;
};

// ─── Quaternion → yaw/pitch helpers ─────────────────────────────────────

const quatToYaw = (q: QuatTuple): number =>
    Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), 1 - 2 * (q[2] * q[2] + q[3] * q[3]));

const quatToPitch = (q: QuatTuple): number => Math.asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[1] - q[3] * q[2]))));

// ─── Movement helpers ───────────────────────────────────────────────────

const computeWishDirection = (input: SerializedInput, yaw: number): { dx: number; dz: number } => {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let dx = 0;
    let dz = 0;
    if (input.forward) {
        dx += forwardX;
        dz += forwardZ;
    }
    if (input.backward) {
        dx -= forwardX;
        dz -= forwardZ;
    }
    if (input.left) {
        dx -= rightX;
        dz -= rightZ;
    }
    if (input.right) {
        dx += rightX;
        dz += rightZ;
    }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
        dx /= len;
        dz /= len;
    }
    return { dx, dz };
};

const computeSpeed = (input: SerializedInput): number => {
    let speed = PLAYER_SPEED;
    if (input.sprint) {
        speed *= SPRINT_MULTIPLIER;
    }
    if (input.crouch) {
        speed *= CROUCH_MULTIPLIER;
    }
    return speed;
};

// ─── Server hit scan ────────────────────────────────────────────────────

type HitScanResult = { closestDist: number; closestEnemy: EntityId } | null;

const PLAYER_CENTER_Y_OFFSET = 1.15;
const PLAYER_RADIUS = 0.5;

const raySphereTest = (
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    targetX: number,
    targetCenterY: number,
    targetZ: number,
    radius: number,
): number | null => {
    const toX = targetX - ox;
    const toY = targetCenterY - oy;
    const toZ = targetZ - oz;

    const projLen = toX * dirX + toY * dirY + toZ * dirZ;
    if (projLen < 0 || projLen > HIT_RANGE) {
        return null;
    }

    const cx = ox + dirX * projLen - targetX;
    const cy = oy + dirY * projLen - targetCenterY;
    const cz = oz + dirZ * projLen - targetZ;
    const distToAxis = Math.sqrt(cx * cx + cy * cy + cz * cz);

    return distToAxis <= radius ? projLen : null;
};

type RayParams = { ox: number; oy: number; oz: number; dirX: number; dirY: number; dirZ: number };

const scanEnemies = (world: World, ray: RayParams, best: { dist: number; target: EntityId | null }) => {
    for (const enemyId of getEntitiesWithTag(world, 'enemy')) {
        const ai = world.ai.get(enemyId);
        if (!ai || ai.state === 'dead') {
            continue;
        }
        const et = world.transform.get(enemyId);
        if (!et) {
            continue;
        }
        const dist = raySphereTest(
            ray.ox,
            ray.oy,
            ray.oz,
            ray.dirX,
            ray.dirY,
            ray.dirZ,
            et.position.x,
            et.position.y + ENEMY_CENTER_Y_OFFSET,
            et.position.z,
            ENEMY_RADIUS,
        );
        if (dist !== null && dist < best.dist) {
            best.dist = dist;
            best.target = enemyId;
        }
    }
};

const scanPlayers = (
    world: World,
    ray: RayParams,
    best: { dist: number; target: EntityId | null },
    excludeEntityId?: EntityId,
) => {
    for (const playerId of getEntitiesWithTag(world, 'player')) {
        if (playerId === excludeEntityId) {
            continue;
        }
        const health = world.health.get(playerId);
        if (!health || health.current <= 0) {
            continue;
        }
        const pt = world.transform.get(playerId);
        if (!pt) {
            continue;
        }
        const dist = raySphereTest(
            ray.ox,
            ray.oy,
            ray.oz,
            ray.dirX,
            ray.dirY,
            ray.dirZ,
            pt.position.x,
            pt.position.y + PLAYER_CENTER_Y_OFFSET,
            pt.position.z,
            PLAYER_RADIUS,
        );
        if (dist !== null && dist < best.dist) {
            best.dist = dist;
            best.target = playerId;
        }
    }
};

const serverHitScan = (
    world: World,
    eyeOrigin: TransformComponent,
    lookRotation: QuatTuple,
    excludeEntityId?: EntityId,
): HitScanResult => {
    const yaw = quatToYaw(lookRotation);
    const pitch = quatToPitch(lookRotation);

    const ray: RayParams = {
        dirX: -Math.sin(yaw) * Math.cos(pitch),
        dirY: Math.sin(pitch),
        dirZ: -Math.cos(yaw) * Math.cos(pitch),
        ox: eyeOrigin.position.x,
        oy: eyeOrigin.position.y,
        oz: eyeOrigin.position.z,
    };

    const best = { dist: HIT_RANGE, target: null as EntityId | null };

    scanEnemies(world, ray, best);
    scanPlayers(world, ray, best, excludeEntityId);

    return best.target !== null ? { closestDist: best.dist, closestEnemy: best.target } : null;
};

// ─── Snapshot builders ──────────────────────────────────────────────────

const buildPlayerSnapshots = (room: Room, world: World, playerEntityMap: Map<string, EntityId>): PlayerSnapshot[] => {
    const result: PlayerSnapshot[] = [];
    for (const slot of room.getPlayers()) {
        const entityId = playerEntityMap.get(slot.id);
        const health = entityId !== undefined ? world.health.get(entityId) : undefined;
        result.push({
            health: health?.current ?? 100,
            id: slot.id,
            position: slot.position,
            rotation: slot.lookRotation,
            stance: slot.stance,
            weaponId: slot.weaponId,
        });
    }
    return result;
};

const buildEnemySnapshots = (world: World, enemyEntityIds: EntityId[]): EnemySnapshot[] => {
    const result: EnemySnapshot[] = [];
    for (const entityId of enemyEntityIds) {
        const t = world.transform.get(entityId);
        const h = world.health.get(entityId);
        const ai = world.ai.get(entityId);
        if (!t) {
            continue;
        }
        result.push({
            entityId,
            health: h?.current ?? 0,
            position: [t.position.x, t.position.y, t.position.z],
            rotation: [t.rotation.w, t.rotation.x, t.rotation.y, t.rotation.z],
            state: ai?.state ?? 'dead',
        });
    }
    return result;
};

const buildPickupSnapshots = (world: World): PickupSnapshot[] => {
    const result: PickupSnapshot[] = [];
    for (const [entityId, pickup] of world.pickup.entries()) {
        const t = world.transform.get(entityId);
        if (!t) {
            continue;
        }
        result.push({
            active: pickup.respawnAt === null,
            entityId,
            pickupId: pickup.pickupId,
            position: [t.position.x, t.position.y, t.position.z],
        });
    }
    return result;
};

// ─── Main factory ───────────────────────────────────────────────────────

export const createServerSimulation = (levelDef: LevelDef, room: Room): ServerSimulation => {
    const world: World = createWorld();
    const clock: SimClock = createClock(TICK_HZ);
    const eventQueue: EventQueue = createEventQueue();
    const missionState: MissionState = createMissionState('eliminate', levelDef.enemies.length);

    const playerEntityMap = new Map<string, EntityId>();
    const playerLastShotTick = new Map<string, number>();
    const enemyEntityIds: EntityId[] = [];
    let simTime = 0;
    let ticks = 0;

    const RIFLE_FIRE_INTERVAL = Math.ceil(TICK_HZ / (WEAPON_REGISTRY.rifle?.fireRateHz ?? 10));

    const spawnLevelEnemies = () => {
        for (const enemySpawn of levelDef.enemies) {
            const def = ENEMY_REGISTRY[enemySpawn.enemyDefId];
            if (!def) {
                continue;
            }
            const id = spawnEnemy(world, def, enemySpawn.position, enemySpawn.patrolPath);
            enemyEntityIds.push(id);
            if (enemySpawn.spawnId === 'boss') {
                const health = world.health.get(id);
                if (health) {
                    health.current *= 2;
                    health.max *= 2;
                }
            }
        }
    };

    const spawnLevelPickups = () => {
        for (const pickupSpawn of levelDef.pickups) {
            const id = createEntity(world);
            world.transform.set(id, {
                position: { ...pickupSpawn.position },
                rotation: { w: 1, x: 0, y: 0, z: 0 },
            });
            world.pickup.set(id, { pickupId: pickupSpawn.pickupId, respawnAt: null });
            addTag(world, id, 'pickup');
        }
    };

    // Initial spawn
    spawnLevelEnemies();
    spawnLevelPickups();

    const getFirstPlayerEntityId = (): EntityId | null => {
        const ids = getEntitiesWithTag(world, 'player');
        return ids[0] ?? null;
    };

    const resetLevel = () => {
        for (const id of enemyEntityIds) {
            destroyEntity(world, id);
        }
        enemyEntityIds.length = 0;

        for (const id of getEntitiesWithTag(world, 'pickup')) {
            destroyEntity(world, id);
        }

        spawnLevelEnemies();
        spawnLevelPickups();

        missionState.isComplete = false;
        missionState.killCount = 0;
        simTime = 0;
    };

    const applyKinematicFallback = (transform: TransformComponent, input: SerializedInput, dt: number) => {
        const yaw = quatToYaw(input.lookRotation);
        const { dx, dz } = computeWishDirection(input, yaw);
        const speed = computeSpeed(input);

        transform.position.x += dx * speed * dt;
        transform.position.z += dz * speed * dt;

        if (transform.position.y > PLAYER_GROUND_Y) {
            transform.position.y = PLAYER_GROUND_Y;
        } else if (transform.position.y < 0) {
            transform.position.y = 0;
        }
    };

    const applyPlayerMovement = (slot: PlayerSlot, input: SerializedInput, dt: number) => {
        const entityId = playerEntityMap.get(slot.id);
        if (entityId === undefined) {
            return;
        }

        const transform = world.transform.get(entityId);
        if (!transform) {
            return;
        }

        if (input.cameraPosition) {
            transform.position.x = input.cameraPosition[0];
            transform.position.y = input.cameraPosition[1] - PLAYER_EYE_Y_OFFSET;
            transform.position.z = input.cameraPosition[2];
        } else {
            applyKinematicFallback(transform, input, dt);
        }

        transform.rotation.w = input.lookRotation[0];
        transform.rotation.x = input.lookRotation[1];
        transform.rotation.y = input.lookRotation[2];
        transform.rotation.z = input.lookRotation[3];

        slot.position = [transform.position.x, transform.position.y, transform.position.z];
        slot.lookRotation = input.lookRotation;
        slot.stance = input.crouch ? 'crouching' : 'standing';
    };

    const processShoot = (playerId: string, input: SerializedInput) => {
        const entityId = playerEntityMap.get(playerId);
        if (entityId === undefined) {
            return;
        }

        const playerTransform = world.transform.get(entityId);
        if (!playerTransform) {
            return;
        }

        // Use client-reported camera position for accurate hit scanning.
        // The server's simplified kinematic movement diverges from the client's
        // Rapier physics, so the server transform is unreliable for ray origin.
        const hitOrigin: TransformComponent = input.cameraPosition
            ? {
                  position: {
                      x: input.cameraPosition[0],
                      y: input.cameraPosition[1],
                      z: input.cameraPosition[2],
                  },
                  rotation: playerTransform.rotation,
              }
            : {
                  position: {
                      x: playerTransform.position.x,
                      y: playerTransform.position.y + PLAYER_EYE_Y_OFFSET,
                      z: playerTransform.position.z,
                  },
                  rotation: playerTransform.rotation,
              };

        const hit = serverHitScan(world, hitOrigin, input.lookRotation, entityId);

        if (!hit) {
            return;
        }

        const yaw = quatToYaw(input.lookRotation);
        const pitch = quatToPitch(input.lookRotation);
        const dirY = Math.sin(pitch);

        const hitY = hitOrigin.position.y + dirY * hit.closestDist;
        const enemyT = world.transform.get(hit.closestEnemy);
        const isHeadshot = enemyT ? hitY > enemyT.position.y + HEADSHOT_Y_THRESHOLD : false;

        eventQueue.write.push({
            amount: BASE_DAMAGE,
            hitNormal: { x: 0, y: 0, z: 1 },
            hitPoint: {
                x: hitOrigin.position.x + -Math.sin(yaw) * Math.cos(pitch) * hit.closestDist,
                y: hitY,
                z: hitOrigin.position.z + -Math.cos(yaw) * Math.cos(pitch) * hit.closestDist,
            },
            isHeadshot,
            targetId: hit.closestEnemy,
            type: 'damage',
        });

        room.broadcast({
            damage: BASE_DAMAGE * (isHeadshot ? 2 : 1),
            isHeadshot,
            shooterId: playerId,
            targetId: hit.closestEnemy,
            type: 's:hitConfirm',
        });
    };

    return {
        applyInput: (playerId: string, input: SerializedInput, seq: number) => {
            const slot = room.getPlayer(playerId);
            if (!slot) {
                return;
            }

            slot.lastInputSeq = seq;
            applyPlayerMovement(slot, input, clock.dt);

            if (input.shoot) {
                const lastShot = playerLastShotTick.get(playerId) ?? -Infinity;
                if (ticks - lastShot >= RIFLE_FIRE_INTERVAL) {
                    playerLastShotTick.set(playerId, ticks);
                    processShoot(playerId, input);
                }
            }
        },

        destroy: () => {
            playerEntityMap.clear();
            enemyEntityIds.length = 0;
        },

        getSnapshot: (): WorldSnapshot => ({
            enemies: buildEnemySnapshots(world, enemyEntityIds),
            pickups: buildPickupSnapshots(world),
            players: buildPlayerSnapshots(room, world, playerEntityMap),
        }),

        registerPlayer: (slot: PlayerSlot) => {
            const id = createEntity(world);
            playerEntityMap.set(slot.id, id);

            world.transform.set(id, {
                position: { x: slot.position[0], y: slot.position[1], z: slot.position[2] },
                rotation: { w: 1, x: 0, y: 0, z: 0 },
            });
            world.health.set(id, {
                current: 100,
                max: 100,
                shieldCurrent: 0,
                shieldMax: 0,
                shieldRechargeDelay: 0,
            });
            world.weaponOwner.set(id, {
                ammo: { knife: { magazine: 1, reserve: 0 }, rifle: { magazine: 30, reserve: 90 } },
                equippedWeaponId: 'rifle',
            });
            addTag(world, id, 'player');
        },

        removePlayer: (playerId: string) => {
            const entityId = playerEntityMap.get(playerId);
            if (entityId !== undefined) {
                world.transform.delete(entityId);
                world.health.delete(entityId);
                world.weaponOwner.delete(entityId);
                world.tags.delete(entityId);
                playerEntityMap.delete(playerId);
            }
            playerLastShotTick.delete(playerId);
        },

        reset: () => {
            resetLevel();
            console.log('[sim] Level reset — enemies and pickups re-spawned');
        },

        tick: () => {
            const dt = clock.dt;
            simTime += dt;
            ticks += 1;

            const outEvents: SimEvent[] = eventQueue.write;
            const playerEntityId = getFirstPlayerEntityId();

            aiSystem(world, playerEntityId, ENEMY_REGISTRY, dt, outEvents, levelDef.walls);

            const damageEvents: DamageEvent[] = [];
            for (const event of outEvents) {
                if (event.type === 'damage') {
                    damageEvents.push(event);
                }
            }

            applyDamageSystem(world, damageEvents, outEvents);

            for (const pid of getEntitiesWithTag(world, 'player')) {
                pickupSystem(world, pid, simTime, outEvents);
            }

            statusEffectSystem(world, dt);
            applyShieldRegen(world, dt);
            missionSystem(missionState, outEvents, outEvents);

            swapEventBuffers(eventQueue);
        },

        tickCount: () => ticks,
    };
};
