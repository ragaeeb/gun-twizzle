import type { Quaternion, Vector3 } from 'three';

export const WeaponAnimation = {
    Idle: 'Idle',
    Inspect: 'Inspect',
    Reload: 'Reload',
    Shoot: 'Shoot',
    Switch: 'Switch',
} as const;

export type WeaponAnimation = (typeof WeaponAnimation)[keyof typeof WeaponAnimation];

export const WeaponId = {
    AK47: 'AK47',
    KNIFE: 'Knife',
    USP: 'Usp',
} as const;

export type WeaponId = (typeof WeaponId)[keyof typeof WeaponId];

export type WeaponStats = {
    damage: number;
    fireRate: number;
    range: number;
    accuracy: number;
    reloadTime: number;
    magazineSize: number;
    totalAmmo: number;
    weaponType: string;
};

export type WeaponDefinition = {
    id: WeaponId;
    name: string;
    stats: WeaponStats;
    modelPath: string;
    markerPath?: string;
    hudImagePath?: string;
    modelPosition?: [number, number, number];
    modelRotation?: [number, number, number];
    modelScale?: number;
    shootSoundKey?: string;
    shootParticleOffset?: { x: number; y: number; z: number };
};

export type InputState = {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    shoot: boolean;
    reload: boolean;
    sprint: boolean;
    crouch: boolean;
    switchToPrimary: boolean;
    switchToSecondary: boolean;
    switchToKnife: boolean;
    deltaTime: number;
    lookingRotationQuat: Quaternion;
};

export type HitResult = {
    hit: boolean;
    hitPoint: Vector3;
    distance: number;
    hitNormal: Vector3;
    hitCollider: unknown;
    rawHit: unknown;
};

export type HudState = {
    weaponId: WeaponId | null;
    weaponName: string;
    ammo: number;
    totalAmmo: number;
    magazineSize: number;
    hudImage: string;
    isReloading: boolean;
    health: number;
    healthMax: number;
    missionText: string;
};

export type LoadingState = {
    visible: boolean;
    progress: number;
    status: string;
};

export type RemotePlayerState = {
    health: number;
    id: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    stance: string;
    weaponId: WeaponId;
};

export type { NetEvent } from '../net/types';
