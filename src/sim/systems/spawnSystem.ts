import type { EnemyDef } from '../../content/enemies/definitions';
import type { World } from '../world';
import { addTag, createEntity, type EntityId } from '../world';

export const spawnEnemy = (
    world: World,
    enemyDef: EnemyDef,
    position: { x: number; y: number; z: number },
    patrolPath?: Array<{ x: number; y: number; z: number }>,
): EntityId => {
    const id = createEntity(world);

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
        enemyDefId: enemyDef.id,
        patrolIndex: 0,
        patrolPath: patrolPath ?? [],
        state: patrolPath ? 'patrol' : 'idle',
        targetEntityId: null,
    });

    addTag(world, id, 'enemy');
    return id;
};
