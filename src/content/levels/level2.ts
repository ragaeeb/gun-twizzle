import type { LevelDef } from './types';

const STEEL = 0x8888a0;
const RUST = 0xbb8866;
const DARK = 0x6a7080;

/**
 * Level 2: "The Shipyard" — Industrial, darker feel, vertical elements.
 */
export const LEVEL_2: LevelDef = {
    ambientColor: 0xaabbee,
    ambientIntensity: 0.7,
    directionalColor: 0xbbccff,
    directionalIntensity: 1.8,

    enemies: [
        // Ground floor grunts
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: -12, y: 1, z: 5 },
                { x: 12, y: 1, z: 5 },
            ],
            position: { x: -12, y: 1, z: 5 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: 20, y: 1, z: -10 },
        },
        // Catwalk grunts
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: -20, y: 5, z: -15 },
                { x: -20, y: 5, z: -30 },
            ],
            position: { x: -20, y: 5, z: -15 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: 15, y: 5, z: -25 },
        },
        // Commander (marked heavy) at the back
        {
            enemyDefId: 'heavy',
            position: { x: 0, y: 1, z: -35 },
            spawnId: 'commander',
        },
    ],
    groundColor: 0x707888,
    id: 'shipyard',

    missions: [
        { params: { targetEnemySpawnId: 'commander' }, type: 'kill_target' },
        { params: { count: 5 }, type: 'kill_count' },
    ],
    name: 'The Shipyard',

    pickups: [
        { pickupId: 'health', position: { x: -25, y: 0.5, z: 20 } },
        { pickupId: 'health', position: { x: 20, y: 5.5, z: -30 } },
        { pickupId: 'ammo', position: { x: -15, y: 0.5, z: -5 } },
        { pickupId: 'ammo', position: { x: 10, y: 0.5, z: -25 } },
    ],

    playerSpawn: { x: 0, y: 2, z: 25 },
    sunElevation: 15,

    walls: [
        // Perimeter
        { color: STEEL, position: { x: 0, y: 3, z: -45 }, size: { depth: 1, height: 6, width: 70 } },
        { color: STEEL, position: { x: 0, y: 3, z: 30 }, size: { depth: 1, height: 6, width: 70 } },
        { color: STEEL, position: { x: -35, y: 3, z: -7.5 }, size: { depth: 75, height: 6, width: 1 } },
        { color: STEEL, position: { x: 35, y: 3, z: -7.5 }, size: { depth: 75, height: 6, width: 1 } },

        // Catwalks (elevated platforms)
        { color: RUST, position: { x: -20, y: 4.5, z: -22.5 }, size: { depth: 20, height: 0.3, width: 5 } },
        { color: RUST, position: { x: 20, y: 4.5, z: -22.5 }, size: { depth: 20, height: 0.3, width: 5 } },

        // Ramp to left catwalk
        { color: RUST, position: { x: -22, y: 2.5, z: -5 }, size: { depth: 8, height: 0.3, width: 4 } },

        // Crates/cover
        { color: DARK, position: { x: -8, y: 1.5, z: 0 }, size: { depth: 3, height: 3, width: 3 } },
        { color: DARK, position: { x: 8, y: 1.5, z: 0 }, size: { depth: 3, height: 3, width: 3 } },
        { color: DARK, position: { x: 0, y: 1.5, z: -15 }, size: { depth: 4, height: 3, width: 6 } },
        { color: DARK, position: { x: -15, y: 1.5, z: -30 }, size: { depth: 3, height: 3, width: 3 } },
        { color: DARK, position: { x: 15, y: 1.5, z: -30 }, size: { depth: 3, height: 3, width: 3 } },

        // Support pillars
        { color: STEEL, position: { x: -10, y: 3, z: -22 }, size: { depth: 1, height: 6, width: 1 } },
        { color: STEEL, position: { x: 10, y: 3, z: -22 }, size: { depth: 1, height: 6, width: 1 } },
    ],
};
