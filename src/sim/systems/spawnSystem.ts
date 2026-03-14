import type { EnemyDef, EnemyId } from '../../content/enemies/definitions';
import type { World } from '../world';
import { addTag, createEntity, type EntityId } from '../world';

export const spawnEnemy = (
    world: World,
    enemyDef: EnemyDef,
    position: { x: number; y: number; z: number },
    patrolPath?: Array<{ x: number; y: number; z: number }>,
    spawnId?: string,
): EntityId => {
    const id = createEntity(world);
    const normalizedPatrolPath = patrolPath?.map((point) => ({ ...point })) ?? [];

    world.transform.set(id, {
        position: { ...position },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
    });

    world.health.set(id, {
        current: enemyDef.health,
        max: enemyDef.health,
        shieldCurrent: 0,
        shieldMax: 0,
        shieldRechargeDelay: 0,
    });

    world.ai.set(id, {
        attackCooldown: 0,
        enemyDefId: enemyDef.id as EnemyId,
        patrolIndex: 0,
        patrolPath: normalizedPatrolPath,
        spawnId: spawnId ?? null,
        state: normalizedPatrolPath.length > 0 ? 'patrol' : 'idle',
        targetEntityId: null,
    });

    addTag(world, id, 'enemy');
    return id;
};
