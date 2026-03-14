import type { LevelDef } from './types';

const GREY = 0x888888;
const DARK_GREY = 0x666666;

export const LEVEL_1: LevelDef = {
    ambientColor: 0xfff0dd,
    ambientIntensity: 0.5,
    directionalColor: 0xff9944,
    directionalIntensity: 2,

    enemies: [
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: -15, y: 1, z: -20 },
                { x: -5, y: 1, z: -20 },
            ],
            position: { x: -15, y: 1, z: -20 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: 20, y: 1, z: -10 },
        },
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: -10, y: 1, z: -35 },
                { x: 10, y: 1, z: -35 },
            ],
            position: { x: 0, y: 1, z: -35 },
        },
    ],
    groundColor: 0x555555,
    id: 'compound',

    missions: [{ params: { count: 3 }, type: 'kill_count' }],
    name: 'The Compound',

    pickups: [
        { pickupId: 'health', position: { x: -10, y: 0.5, z: 0 } },
        { pickupId: 'ammo', position: { x: 15, y: 0.5, z: -5 } },
        { pickupId: 'shield', position: { x: 5, y: 0.5, z: -15 } },
    ],

    playerSpawn: { x: 0, y: 2, z: 10 },
    sunElevation: 25,

    walls: [
        // Perimeter walls
        { color: GREY, position: { x: 0, y: 2, z: -45 }, size: { depth: 1, height: 4, width: 60 } },
        { color: GREY, position: { x: 0, y: 2, z: 15 }, size: { depth: 1, height: 4, width: 60 } },
        { color: GREY, position: { x: -30, y: 2, z: -15 }, size: { depth: 60, height: 4, width: 1 } },
        { color: GREY, position: { x: 30, y: 2, z: -15 }, size: { depth: 60, height: 4, width: 1 } },

        // Interior cover
        { color: DARK_GREY, position: { x: -8, y: 1.5, z: -10 }, size: { depth: 2, height: 3, width: 4 } },
        { color: DARK_GREY, position: { x: 8, y: 1.5, z: -10 }, size: { depth: 2, height: 3, width: 4 } },
        { color: DARK_GREY, position: { x: 0, y: 1.5, z: -25 }, size: { depth: 6, height: 3, width: 1 } },

        // Pillars
        { color: DARK_GREY, position: { x: -20, y: 2, z: -15 }, size: { depth: 2, height: 4, width: 2 } },
        { color: DARK_GREY, position: { x: 20, y: 2, z: -15 }, size: { depth: 2, height: 4, width: 2 } },

        // Low overhang — requires crouch/slide to pass under (1.2m clearance vs 1.8m standing)
        { color: DARK_GREY, position: { x: -3.5, y: 1, z: 0 }, size: { depth: 4, height: 2, width: 1 } },
        { color: DARK_GREY, position: { x: 3.5, y: 1, z: 0 }, size: { depth: 4, height: 2, width: 1 } },
        { color: GREY, position: { x: 0, y: 1.35, z: 0 }, size: { depth: 4, height: 0.3, width: 8 } },
    ],
};
