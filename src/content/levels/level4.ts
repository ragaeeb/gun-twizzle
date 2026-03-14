import type { LevelDef } from './types';

const SAND = 0xa06a3b;
const BACKSTOP = 0x2d2d2d;
const LANE = 0x6a4526;
const ACCENT = 0xf3bf3c;

/**
 * Level 4: "Training Grounds" — stationary targets in a safe firing range.
 */
export const LEVEL_4: LevelDef = {
    ambientColor: 0xfff1dc,
    ambientIntensity: 0.55,
    directionalColor: 0xffcc88,
    directionalIntensity: 1.9,

    enemies: [
        { enemyDefId: 'trainingDummy', position: { x: -18, y: 1, z: -18 } },
        { enemyDefId: 'trainingDummy', position: { x: -8, y: 1, z: -24 } },
        { enemyDefId: 'trainingDummy', position: { x: 2, y: 1, z: -18 } },
        { enemyDefId: 'trainingDummy', position: { x: 12, y: 1, z: -28 } },
        { enemyDefId: 'trainingDummy', position: { x: -14, y: 1, z: -38 } },
        { enemyDefId: 'trainingDummy', position: { x: 8, y: 1, z: -42 } },
    ],
    groundColor: SAND,
    id: 'training-grounds',

    missions: [{ params: { count: 6 }, type: 'kill_count' }],
    name: 'Training Grounds',

    pickups: [
        { pickupId: 'ammo', position: { x: -10, y: 0.5, z: 10 } },
        { pickupId: 'ammo', position: { x: 10, y: 0.5, z: 10 } },
        { pickupId: 'health', position: { x: 0, y: 0.5, z: 6 } },
    ],

    playerSpawn: { x: 0, y: 2, z: 18 },
    sunElevation: 32,

    walls: [
        { color: BACKSTOP, position: { x: 0, y: 2.5, z: -50 }, size: { depth: 1, height: 5, width: 70 } },
        { color: BACKSTOP, position: { x: 0, y: 2.5, z: 22 }, size: { depth: 1, height: 5, width: 70 } },
        { color: BACKSTOP, position: { x: -35, y: 2.5, z: -14 }, size: { depth: 72, height: 5, width: 1 } },
        { color: BACKSTOP, position: { x: 35, y: 2.5, z: -14 }, size: { depth: 72, height: 5, width: 1 } },

        { color: LANE, position: { x: 0, y: 1, z: 4 }, size: { depth: 4, height: 2, width: 16 } },
        { color: LANE, position: { x: -12, y: 1, z: -8 }, size: { depth: 28, height: 2, width: 1 } },
        { color: LANE, position: { x: 12, y: 1, z: -8 }, size: { depth: 28, height: 2, width: 1 } },
        { color: LANE, position: { x: 0, y: 1, z: -20 }, size: { depth: 36, height: 2, width: 1 } },

        { color: ACCENT, position: { x: -18, y: 1, z: -18 }, size: { depth: 1.5, height: 2, width: 1.5 } },
        { color: ACCENT, position: { x: -8, y: 1, z: -24 }, size: { depth: 1.5, height: 2, width: 1.5 } },
        { color: ACCENT, position: { x: 2, y: 1, z: -18 }, size: { depth: 1.5, height: 2, width: 1.5 } },
        { color: ACCENT, position: { x: 12, y: 1, z: -28 }, size: { depth: 1.5, height: 2, width: 1.5 } },
        { color: ACCENT, position: { x: -14, y: 1, z: -38 }, size: { depth: 1.5, height: 2, width: 1.5 } },
        { color: ACCENT, position: { x: 8, y: 1, z: -42 }, size: { depth: 1.5, height: 2, width: 1.5 } },
    ],
};
