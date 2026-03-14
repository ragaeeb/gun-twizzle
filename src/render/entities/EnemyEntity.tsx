import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

import type { EntityId, World } from '../../sim/world';
import { disposeObject3D } from './disposeHelpers';

type EnemyEntityProps = {
    entityId: EntityId;
    world: World;
};

const ENEMY_COLOR_IDLE = 0xcc3333;
const ENEMY_COLOR_CHASE = 0xff6600;
const ENEMY_COLOR_ATTACK = 0xff0000;
const ENEMY_COLOR_DEAD = 0x444444;

type EnemyTransformLike = {
    position: {
        x: number;
        y: number;
        z: number;
    };
};

type EnemyAiLike = {
    state: string;
};

type EnemyHealthLike = {
    current: number;
    max: number;
};

const getColorForState = (state: string): number => {
    switch (state) {
        case 'chase':
            return ENEMY_COLOR_CHASE;
        case 'attack':
            return ENEMY_COLOR_ATTACK;
        case 'dead':
            return ENEMY_COLOR_DEAD;
        default:
            return ENEMY_COLOR_IDLE;
    }
};

const updateGroupTransform = (group: THREE.Group, transform: EnemyTransformLike, ai: EnemyAiLike | undefined) => {
    group.visible = ai?.state !== 'dead';
    group.position.set(transform.position.x, transform.position.y, transform.position.z);
};

const updateMaterialColor = (material: THREE.MeshStandardMaterial | null, ai: EnemyAiLike | undefined) => {
    if (!material || !ai) {
        return;
    }

    material.color.setHex(getColorForState(ai.state));
};

const updateHealthBar = (
    fill: THREE.Mesh | null,
    group: THREE.Group | null,
    health: EnemyHealthLike | undefined,
    ai: EnemyAiLike | undefined,
    camera: THREE.Camera,
) => {
    if (!fill || !group || !health) {
        return;
    }

    const ratio = health.max > 0 ? Math.max(0, Math.min(1, health.current / health.max)) : 0;
    fill.scale.x = ratio;
    fill.position.x = (ratio - 1) * 0.5;

    // Color: green → yellow → red
    const fillMat = fill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) {
        fillMat.color.setHex(0x44ff44);
    } else if (ratio > 0.3) {
        fillMat.color.setHex(0xffdd00);
    } else {
        fillMat.color.setHex(0xff4444);
    }

    // Billboard: make health bar always face camera
    group.quaternion.copy(camera.quaternion);

    // Hide health bar if at full health
    group.visible = ratio < 1 && ai?.state !== 'dead';
};

/**
 * Renders an enemy entity as a placeholder capsule mesh with a health bar.
 * Reads transform and AI state imperatively from the ECS world each frame.
 */
export const EnemyEntity = ({ entityId, world }: EnemyEntityProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const headMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const healthBarFillRef = useRef<THREE.Mesh>(null);
    const healthBarGroupRef = useRef<THREE.Group>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (groupRef.current) {
                disposeObject3D(groupRef.current);
            }
        };
    }, []);

    // Imperative per-frame update (no React state)
    useFrame((state) => {
        if (!groupRef.current) {
            return;
        }

        const transform = world.transform.get(entityId);
        const ai = world.ai.get(entityId);
        const health = world.health.get(entityId);

        if (!transform) {
            groupRef.current.visible = false;
            return;
        }

        updateGroupTransform(groupRef.current, transform, ai);
        updateMaterialColor(bodyMaterialRef.current, ai);
        updateMaterialColor(headMaterialRef.current, ai);
        updateHealthBar(healthBarFillRef.current, healthBarGroupRef.current, health, ai, state.camera);
    });

    return (
        <group ref={groupRef}>
            {/* Body — capsule approximation with cylinder + spheres */}
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.4, 0.4, 1.6, 8]} />
                <meshStandardMaterial ref={bodyMaterialRef} color={ENEMY_COLOR_IDLE} roughness={0.7} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 0]} castShadow>
                <sphereGeometry args={[0.3, 8, 6]} />
                <meshStandardMaterial ref={headMaterialRef} color={ENEMY_COLOR_IDLE} roughness={0.7} />
            </mesh>
            {/* Health bar — floats above head */}
            <group ref={healthBarGroupRef} position={[0, 2.7, 0]}>
                {/* Background (dark) */}
                <mesh position={[0, 0, -0.01]}>
                    <planeGeometry args={[1.0, 0.1]} />
                    <meshBasicMaterial color={0x222222} transparent opacity={0.7} />
                </mesh>
                {/* Fill (green/yellow/red) */}
                <mesh ref={healthBarFillRef}>
                    <planeGeometry args={[1.0, 0.1]} />
                    <meshBasicMaterial color={0x44ff44} />
                </mesh>
            </group>
        </group>
    );
};
