import type { EnemyDef, EnemyRegistry } from '../../content/enemies/definitions';
import type { WallDef } from '../../content/levels/types';
import type { SimEvent } from '../events';
import { hasLineOfSight } from '../lineOfSight';
import type { AIComponent, EntityId, TransformComponent, World } from '../world';
import { getEntitiesWithTag } from '../world';

const AI_EYE_Y_OFFSET = 1.15;

const distanceSq = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
};

const moveToward = (
    current: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    maxDist: number,
): void => {
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) {
        return;
    }

    const step = Math.min(maxDist, dist);
    current.x += (dx / dist) * step;
    current.z += (dz / dist) * step;
};

const moveAwayFrom = (
    current: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    maxDist: number,
): void => {
    const dx = current.x - target.x;
    const dz = current.z - target.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) {
        return;
    }

    const step = Math.min(maxDist, dist);
    current.x += (dx / dist) * step;
    current.z += (dz / dist) * step;
};

const canAttackPlayer = (
    enemyPosition: { x: number; y: number; z: number },
    playerPosition: { x: number; y: number; z: number },
    walls: WallDef[],
): boolean =>
    hasLineOfSight(
        { x: enemyPosition.x, y: enemyPosition.y + AI_EYE_Y_OFFSET, z: enemyPosition.z },
        { x: playerPosition.x, y: playerPosition.y + AI_EYE_Y_OFFSET, z: playerPosition.z },
        walls,
    );

const handleDeath = (ai: AIComponent): void => {
    if (ai.state === 'dead') {
        return;
    }
    ai.state = 'dead';
    ai.targetEntityId = null;
};

const handleIdleOrPatrol = (
    ai: AIComponent,
    dSq: number,
    detectionRangeSq: number,
    playerEntityId: EntityId,
    transform: TransformComponent,
    speed: number,
    dt: number,
): void => {
    if (dSq <= detectionRangeSq) {
        ai.state = 'chase';
        ai.targetEntityId = playerEntityId;
        return;
    }

    if (ai.patrolPath.length === 0) {
        ai.state = 'idle';
        ai.targetEntityId = null;
        return;
    }

    if (ai.state !== 'patrol') {
        ai.state = 'patrol';
    }
    ai.targetEntityId = null;

    const target = ai.patrolPath[ai.patrolIndex];
    if (!target) {
        ai.patrolIndex = 0;
        return;
    }

    moveToward(transform.position, target, speed * dt);
    if (distanceSq(transform.position, target) < 0.04) {
        ai.patrolIndex = (ai.patrolIndex + 1) % ai.patrolPath.length;
    }
};

const handleChase = (
    ai: AIComponent,
    dSq: number,
    disengageRangeSq: number,
    attackRangeSq: number,
    playerEntityId: EntityId,
    transform: TransformComponent,
    playerPosition: { x: number; y: number; z: number },
    speed: number,
    dt: number,
    walls: WallDef[],
): void => {
    if (dSq > disengageRangeSq) {
        ai.state = ai.patrolPath.length > 0 ? 'patrol' : 'idle';
        ai.targetEntityId = null;
    } else if (dSq <= attackRangeSq && canAttackPlayer(transform.position, playerPosition, walls)) {
        ai.state = 'attack';
        ai.targetEntityId = playerEntityId;
    } else {
        moveToward(transform.position, playerPosition, speed * dt);
    }
};

const handleAttack = (
    ai: AIComponent,
    dSq: number,
    attackRangeSq: number,
    preferredRange: number,
    def: EnemyDef,
    transform: TransformComponent,
    playerEntityId: EntityId,
    playerPosition: { x: number; y: number; z: number },
    dt: number,
    walls: WallDef[],
    outEvents: SimEvent[],
): void => {
    if (dSq > attackRangeSq) {
        ai.state = 'chase';
        return;
    }

    if (!canAttackPlayer(transform.position, playerPosition, walls)) {
        ai.state = 'chase';
        return;
    }

    // Snipers maintain preferred distance
    if (preferredRange > 0) {
        const dist = Math.sqrt(dSq);
        const preferredSq = preferredRange * preferredRange;
        if (dist < preferredRange * 0.7) {
            moveAwayFrom(transform.position, playerPosition, def.speed * dt);
        } else if (dSq > preferredSq * 1.1) {
            moveToward(transform.position, playerPosition, def.speed * dt);
        }
    }

    ai.attackCooldown -= dt;
    if (ai.attackCooldown <= 0) {
        ai.attackCooldown = 1.0 / def.attackRateHz;
        outEvents.push({
            position: { ...transform.position },
            soundId: 'gunshot',
            type: 'playSound',
            volume: 0.75,
        });
        outEvents.push({
            amount: def.attackDamage,
            hitNormal: { x: 0, y: 0, z: 0 },
            hitPoint: { ...playerPosition },
            isHeadshot: false,
            targetId: playerEntityId,
            type: 'damage',
        });
    }
};

const updateEnemy = (
    world: World,
    entityId: EntityId,
    enemyDefs: EnemyRegistry,
    playerEntityId: EntityId,
    playerPosition: { x: number; y: number; z: number },
    dt: number,
    walls: WallDef[],
    outEvents: SimEvent[],
): void => {
    const ai = world.ai.get(entityId);
    const health = world.health.get(entityId);
    const transform = world.transform.get(entityId);

    if (!ai || !transform) {
        return;
    }

    if (health && health.current <= 0) {
        handleDeath(ai);
        return;
    }

    // Look up per-enemy def
    const def = enemyDefs[ai.enemyDefId];
    if (!def) {
        ai.state = 'idle';
        ai.targetEntityId = null;
        return;
    }

    if (def.isDormant) {
        ai.state = 'idle';
        ai.targetEntityId = null;
        return;
    }

    const detectionRangeSq = def.detectionRange * def.detectionRange;
    const attackRangeSq = def.attackRange * def.attackRange;
    const disengageRangeSq = (def.detectionRange * 1.5) ** 2;

    const dSq = distanceSq(transform.position, playerPosition);

    if (ai.state === 'idle' || ai.state === 'patrol') {
        handleIdleOrPatrol(ai, dSq, detectionRangeSq, playerEntityId, transform, def.speed, dt);
    } else if (ai.state === 'chase') {
        handleChase(
            ai,
            dSq,
            disengageRangeSq,
            attackRangeSq,
            playerEntityId,
            transform,
            playerPosition,
            def.runSpeed,
            dt,
            walls,
        );
    } else if (ai.state === 'attack') {
        handleAttack(
            ai,
            dSq,
            attackRangeSq,
            def.preferredRange,
            def,
            transform,
            playerEntityId,
            playerPosition,
            dt,
            walls,
            outEvents,
        );
    }
};

/**
 * Run one AI tick for all entities with the 'enemy' tag.
 * Pure logic — no physics, no rendering.
 */
export const aiSystem = (
    world: World,
    playerEntityId: EntityId | null,
    enemyDefs: EnemyRegistry,
    dt: number,
    outEvents: SimEvent[],
    walls: WallDef[] = [],
): void => {
    if (playerEntityId === null) {
        return;
    }

    const playerTransform = world.transform.get(playerEntityId);
    if (!playerTransform) {
        return;
    }

    for (const entityId of getEntitiesWithTag(world, 'enemy')) {
        updateEnemy(world, entityId, enemyDefs, playerEntityId, playerTransform.position, dt, walls, outEvents);
    }
};
