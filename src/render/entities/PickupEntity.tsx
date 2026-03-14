import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { AssetRegistry } from '../../assets/registry';
import type { EntityId, World } from '../../sim/world';

type PickupEntityProps = {
    entityId: EntityId;
    pickupId: string;
    world: World;
};

type PickupModelConfig = {
    path: string;
    targetSize: number;
};

const PICKUP_MODELS: Record<string, PickupModelConfig> = {
    ammo: {
        path: AssetRegistry.pickups.ammo,
        targetSize: 0.9,
    },
    health: {
        path: AssetRegistry.pickups.health,
        targetSize: 0.85,
    },
    shield: {
        path: AssetRegistry.pickups.shield,
        targetSize: 0.85,
    },
};

const preparePickupModel = (scene: THREE.Group, targetSize: number) => {
    const clonedScene = scene.clone(true);
    clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const bounds = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / maxDimension;
    clonedScene.scale.setScalar(scale);

    const scaledBounds = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    scaledBounds.getCenter(center);
    clonedScene.position.set(-center.x, -scaledBounds.min.y, -center.z);

    return clonedScene;
};

export const PickupEntity = ({ entityId, pickupId, world }: PickupEntityProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const config = PICKUP_MODELS[pickupId];
    const { scene } = useGLTF(config?.path ?? AssetRegistry.pickups.health);
    const pickupModel = useMemo(
        () => preparePickupModel(scene, config?.targetSize ?? 0.85),
        [config?.targetSize, scene],
    );

    useFrame((state) => {
        if (!groupRef.current) {
            return;
        }

        const transform = world.transform.get(entityId);
        const pickup = world.pickup.get(entityId);
        if (!transform || !pickup || pickup.respawnAt !== null) {
            groupRef.current.visible = false;
            return;
        }

        groupRef.current.visible = true;
        groupRef.current.position.set(
            transform.position.x,
            transform.position.y + Math.sin(state.clock.elapsedTime * 2) * 0.2 + 0.5,
            transform.position.z,
        );
        groupRef.current.rotation.y = state.clock.elapsedTime;
    });

    return (
        <group ref={groupRef}>
            <primitive object={pickupModel} />
        </group>
    );
};

useGLTF.preload(AssetRegistry.pickups.health);
useGLTF.preload(AssetRegistry.pickups.ammo);
useGLTF.preload(AssetRegistry.pickups.shield);
