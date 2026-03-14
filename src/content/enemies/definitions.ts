export type EnemyDef = {
    attackDamage: number;
    attackRange: number;
    attackRateHz: number;
    detectionRange: number;
    health: number;
    id: string;
    isDormant: boolean;
    modelPath: string;
    name: string;
    preferredRange: number; // 0 = close in, >0 = try to stay at this distance
    runSpeed: number;
    scoreValue: number;
    speed: number;
};

export const ENEMY_REGISTRY = {
    grunt: {
        attackDamage: 12,
        attackRange: 20,
        attackRateHz: 1.5,
        detectionRange: 25,
        health: 80,
        id: 'grunt',
        isDormant: false,
        modelPath: '',
        name: 'Security Grunt',
        preferredRange: 0,
        runSpeed: 5,
        scoreValue: 100,
        speed: 2.5,
    },
    heavy: {
        attackDamage: 25,
        attackRange: 12,
        attackRateHz: 0.8,
        detectionRange: 18,
        health: 200,
        id: 'heavy',
        isDormant: false,
        modelPath: '',
        name: 'Heavy Enforcer',
        preferredRange: 0,
        runSpeed: 3,
        scoreValue: 250,
        speed: 1.5,
    },
    sniper: {
        attackDamage: 35,
        attackRange: 50,
        attackRateHz: 0.5,
        detectionRange: 60,
        health: 60,
        id: 'sniper',
        isDormant: false,
        modelPath: '',
        name: 'Sharpshooter',
        preferredRange: 30,
        runSpeed: 4,
        scoreValue: 200,
        speed: 2,
    },
    trainingDummy: {
        attackDamage: 0,
        attackRange: 0,
        attackRateHz: 0,
        detectionRange: 0,
        health: 90,
        id: 'trainingDummy',
        isDormant: true,
        modelPath: '',
        name: 'Training Dummy',
        preferredRange: 0,
        runSpeed: 0,
        scoreValue: 25,
        speed: 0,
    },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMY_REGISTRY;
export type EnemyRegistry = typeof ENEMY_REGISTRY;
