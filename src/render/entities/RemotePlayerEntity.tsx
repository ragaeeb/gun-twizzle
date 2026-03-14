import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

import type { RemotePlayerState } from '../../runtime/types';

type RemotePlayerEntityProps = {
    player: RemotePlayerState;
};

const PLAYER_COLOR = 0x3388ff;
const CROUCH_COLOR = 0x2266cc;
const LERP_SPEED = 12;

const _targetPos = new THREE.Vector3();

const quatToYaw = (r: [number, number, number, number]): number => {
    const [w, x, y, z] = r;
    return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
};

const PLAYER_MAX_HEALTH = 100;

const updateCrouchState = (
    isCrouching: boolean,
    body: THREE.Mesh | null,
    head: THREE.Mesh | null,
    healthBar: THREE.Group | null,
) => {
    if (body) {
        body.position.y = isCrouching ? 0.6 : 1;
        body.scale.y = isCrouching ? 0.7 : 1;
    }
    if (head) {
        head.position.y = isCrouching ? 1.35 : 2;
    }
    if (healthBar) {
        healthBar.position.y = isCrouching ? 1.8 : 2.7;
    }
};

const updateHealthBar = (
    fill: THREE.Mesh | null,
    barGroup: THREE.Group | null,
    health: number,
    camera: THREE.Camera,
) => {
    if (!fill || !barGroup) {
        return;
    }
    const ratio = Math.max(0, health / PLAYER_MAX_HEALTH);
    fill.scale.x = ratio;
    fill.position.x = (ratio - 1) * 0.5;

    const fillMat = fill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) {
        fillMat.color.setHex(0x44ff44);
    } else if (ratio > 0.3) {
        fillMat.color.setHex(0xffdd00);
    } else {
        fillMat.color.setHex(0xff4444);
    }

    barGroup.quaternion.copy(camera.quaternion);
    barGroup.visible = ratio < 1;
};

/**
 * Renders a remote player as a capsule-like mesh (cylinder + sphere head)
 * with a floating name tag. Position and rotation are smoothly interpolated
 * from server snapshot data.
 */
export const RemotePlayerEntity = ({ player }: RemotePlayerEntityProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Mesh>(null);
    const headRef = useRef<THREE.Mesh>(null);
    const healthBarGroupRef = useRef<THREE.Group>(null);
    const healthBarFillRef = useRef<THREE.Mesh>(null);
    const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);

    useFrame((state, delta) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        _targetPos.set(player.position[0], player.position[1], player.position[2]);
        group.position.lerp(_targetPos, Math.min(LERP_SPEED * delta, 1));
        group.rotation.y = quatToYaw(player.rotation);

        if (bodyMatRef.current) {
            bodyMatRef.current.color.setHex(player.stance === 'crouching' ? CROUCH_COLOR : PLAYER_COLOR);
        }

        updateCrouchState(player.stance === 'crouching', bodyRef.current, headRef.current, healthBarGroupRef.current);
        updateHealthBar(healthBarFillRef.current, healthBarGroupRef.current, player.health, state.camera);
    });

    return (
        <group ref={groupRef} position={[player.position[0], player.position[1], player.position[2]]}>
            {/* Body */}
            <mesh ref={bodyRef} position={[0, 1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.35, 0.35, 1.6, 8]} />
                <meshStandardMaterial ref={bodyMatRef} color={PLAYER_COLOR} roughness={0.6} metalness={0.2} />
            </mesh>
            {/* Head */}
            <mesh ref={headRef} position={[0, 2, 0]} castShadow>
                <sphereGeometry args={[0.28, 8, 6]} />
                <meshStandardMaterial color={PLAYER_COLOR} roughness={0.6} metalness={0.2} />
            </mesh>
            {/* Health bar — floats above head, billboard */}
            <group ref={healthBarGroupRef} position={[0, 2.7, 0]}>
                <mesh position={[0, 0, -0.01]}>
                    <planeGeometry args={[1.0, 0.1]} />
                    <meshBasicMaterial color={0x222222} transparent opacity={0.7} />
                </mesh>
                <mesh ref={healthBarFillRef}>
                    <planeGeometry args={[1.0, 0.1]} />
                    <meshBasicMaterial color={0x44ff44} />
                </mesh>
            </group>
        </group>
    );
};
