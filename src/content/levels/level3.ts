import type { LevelDef } from './types';

const WHITE = 0xd4d8de;
const LIGHT_GREY = 0xb9bec7;
const DARK_PANEL = 0x5c6675;
const ACCENT = 0x3f86c9;
const FLOOR = 0x6d7684;

/**
 * Level 3: "The Facility" — Large clean-tech campus with long flanking lanes and a safer spawn pocket.
 */
export const LEVEL_3: LevelDef = {
    ambientColor: 0xeeeeff,
    ambientIntensity: 0.7,
    directionalColor: 0xffeedd,
    directionalIntensity: 1.8,

    enemies: [
        // Forward lane guards
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: -34, y: 1, z: 8 },
                { x: -20, y: 1, z: -6 },
            ],
            position: { x: -34, y: 1, z: 8 },
        },
        {
            enemyDefId: 'grunt',
            patrolPath: [
                { x: 34, y: 1, z: 6 },
                { x: 20, y: 1, z: -8 },
            ],
            position: { x: 34, y: 1, z: 6 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: -12, y: 1, z: -14 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: 18, y: 1, z: -26 },
        },
        {
            enemyDefId: 'grunt',
            position: { x: -30, y: 1, z: -36 },
        },
        {
            enemyDefId: 'sniper',
            position: { x: -42, y: 5, z: -46 },
        },
        {
            enemyDefId: 'sniper',
            position: { x: 40, y: 5, z: -42 },
        },
        {
            enemyDefId: 'heavy',
            position: { x: 0, y: 1, z: -56 },
            spawnId: 'boss',
        },
    ],
    groundColor: FLOOR,
    id: 'facility',

    missions: [
        { params: { count: 8 }, type: 'kill_count' },
        { params: { durationSeconds: 60 }, type: 'survive_timer' },
    ],
    name: 'The Facility',

    pickups: [
        { pickupId: 'health', position: { x: -18, y: 0.5, z: 28 } },
        { pickupId: 'health', position: { x: 16, y: 0.5, z: 20 } },
        { pickupId: 'health', position: { x: 0, y: 0.5, z: -12 } },
        { pickupId: 'ammo', position: { x: -32, y: 0.5, z: 14 } },
        { pickupId: 'ammo', position: { x: 28, y: 0.5, z: -6 } },
    ],

    playerSpawn: { x: 0, y: 2, z: 42 },
    sunElevation: 68,

    walls: [
        // Outer perimeter
        { color: WHITE, position: { x: 0, y: 3, z: -72 }, size: { depth: 1, height: 6, width: 120 } },
        { color: WHITE, position: { x: 0, y: 3, z: 52 }, size: { depth: 1, height: 6, width: 120 } },
        { color: WHITE, position: { x: -60, y: 3, z: -10 }, size: { depth: 124, height: 6, width: 1 } },
        { color: WHITE, position: { x: 60, y: 3, z: -10 }, size: { depth: 124, height: 6, width: 1 } },

        // Spawn pocket
        { color: LIGHT_GREY, position: { x: 0, y: 2, z: 32 }, size: { depth: 10, height: 4, width: 22 } },
        { color: LIGHT_GREY, position: { x: -17, y: 2, z: 39 }, size: { depth: 18, height: 4, width: 1 } },
        { color: LIGHT_GREY, position: { x: 17, y: 2, z: 39 }, size: { depth: 18, height: 4, width: 1 } },

        // Main avenue cover
        { color: ACCENT, position: { x: -16, y: 1.25, z: 18 }, size: { depth: 4, height: 2.5, width: 10 } },
        { color: ACCENT, position: { x: 18, y: 1.25, z: 12 }, size: { depth: 4, height: 2.5, width: 10 } },
        { color: ACCENT, position: { x: 0, y: 1.25, z: -6 }, size: { depth: 5, height: 2.5, width: 14 } },
        { color: ACCENT, position: { x: -22, y: 1.25, z: -26 }, size: { depth: 4, height: 2.5, width: 12 } },
        { color: ACCENT, position: { x: 24, y: 1.25, z: -22 }, size: { depth: 4, height: 2.5, width: 12 } },
        { color: ACCENT, position: { x: 0, y: 1.25, z: -44 }, size: { depth: 6, height: 2.5, width: 16 } },

        // Left lane buildings
        { color: DARK_PANEL, position: { x: -44, y: 3, z: 18 }, size: { depth: 14, height: 6, width: 12 } },
        { color: DARK_PANEL, position: { x: -38, y: 3, z: -12 }, size: { depth: 18, height: 6, width: 10 } },
        { color: DARK_PANEL, position: { x: -28, y: 3, z: -48 }, size: { depth: 16, height: 6, width: 14 } },

        // Right lane buildings
        { color: DARK_PANEL, position: { x: 44, y: 3, z: 14 }, size: { depth: 16, height: 6, width: 12 } },
        { color: DARK_PANEL, position: { x: 36, y: 3, z: -18 }, size: { depth: 20, height: 6, width: 10 } },
        { color: DARK_PANEL, position: { x: 28, y: 3, z: -50 }, size: { depth: 18, height: 6, width: 14 } },

        // Midfield barriers
        { color: LIGHT_GREY, position: { x: -8, y: 2, z: 4 }, size: { depth: 12, height: 4, width: 1 } },
        { color: LIGHT_GREY, position: { x: 10, y: 2, z: -8 }, size: { depth: 12, height: 4, width: 1 } },
        { color: LIGHT_GREY, position: { x: -30, y: 2, z: -2 }, size: { depth: 1, height: 4, width: 12 } },
        { color: LIGHT_GREY, position: { x: 32, y: 2, z: -12 }, size: { depth: 1, height: 4, width: 12 } },

        // Sniper towers
        { color: DARK_PANEL, position: { x: -42, y: 4, z: -46 }, size: { depth: 8, height: 0.3, width: 8 } },
        { color: DARK_PANEL, position: { x: 40, y: 4, z: -42 }, size: { depth: 8, height: 0.3, width: 8 } },
        { color: WHITE, position: { x: -42, y: 2, z: -46 }, size: { depth: 1.5, height: 4, width: 1.5 } },
        { color: WHITE, position: { x: 40, y: 2, z: -42 }, size: { depth: 1.5, height: 4, width: 1.5 } },

        // Rear command bunker
        { color: WHITE, position: { x: 0, y: 2.5, z: -62 }, size: { depth: 10, height: 5, width: 24 } },
        { color: ACCENT, position: { x: -16, y: 1.25, z: -56 }, size: { depth: 4, height: 2.5, width: 10 } },
        { color: ACCENT, position: { x: 16, y: 1.25, z: -54 }, size: { depth: 4, height: 2.5, width: 10 } },
    ],
};
