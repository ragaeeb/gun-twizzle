import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { LevelDef, PickupId } from '../content/levels/types';
import type { NetSession } from '../net/session';
import { EnemyEntity } from '../render/entities/EnemyEntity';
import { PickupEntity } from '../render/entities/PickupEntity';
import { RemotePlayerEntity } from '../render/entities/RemotePlayerEntity';
import type { FpsCamera, GameScene } from '../render/scene';
import { GameEngine } from '../runtime/engine';
import type { PhysicsSystem } from '../runtime/physics';
import type { HudState, LoadingState, RemotePlayerState, WeaponId as WeaponIdType } from '../runtime/types';
import type { EntityId, World } from '../sim/world';

const areRemotePlayersEqual = (a: RemotePlayerState[], b: RemotePlayerState[]) => {
    if (a.length !== b.length) {
        return false;
    }

    for (let index = 0; index < a.length; index += 1) {
        const left = a[index];
        const right = b[index];
        if (!left || !right) {
            return false;
        }
        if (
            left.id !== right.id ||
            left.health !== right.health ||
            left.stance !== right.stance ||
            left.weaponId !== right.weaponId
        ) {
            return false;
        }
        if (
            left.position[0] !== right.position[0] ||
            left.position[1] !== right.position[1] ||
            left.position[2] !== right.position[2] ||
            left.rotation[0] !== right.rotation[0] ||
            left.rotation[1] !== right.rotation[1] ||
            left.rotation[2] !== right.rotation[2] ||
            left.rotation[3] !== right.rotation[3]
        ) {
            return false;
        }
    }

    return true;
};

type GameRuntimeProps = {
    camera: FpsCamera;
    levelDef: LevelDef;
    /** When provided, the engine runs in online multiplayer mode. */
    netSession?: NetSession;
    onHudUpdate: (state: HudState) => void;
    onLoadingUpdate: (state: LoadingState) => void;
    onMissionComplete: () => void;
    physics: PhysicsSystem;
    scene: GameScene;
};

export const GameRuntime = ({
    camera,
    levelDef,
    netSession,
    scene,
    physics,
    onHudUpdate,
    onLoadingUpdate,
    onMissionComplete,
}: GameRuntimeProps) => {
    const { gl } = useThree();
    const { world, rapier } = useRapier();
    const engineRef = useRef<GameEngine | null>(null);
    const [ecsWorld, setEcsWorld] = useState<World | null>(null);
    const [enemyIds, setEnemyIds] = useState<EntityId[]>([]);
    const [pickupEntities, setPickupEntities] = useState<Array<{ entityId: EntityId; pickupId: PickupId }>>([]);
    const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);
    const hudStateRef = useRef<HudState | null>(null);
    const loadingStateRef = useRef<LoadingState | null>(null);
    const hudDirtyRef = useRef(false);
    const loadingDirtyRef = useRef(false);

    const queueHudUpdate = useCallback((state: HudState) => {
        hudStateRef.current = state;
        hudDirtyRef.current = true;
    }, []);

    const queueLoadingUpdate = useCallback((state: LoadingState) => {
        loadingStateRef.current = state;
        loadingDirtyRef.current = true;
    }, []);

    useEffect(() => {
        let rafId: number | null = null;

        const flush = () => {
            if (hudDirtyRef.current && hudStateRef.current) {
                hudDirtyRef.current = false;
                onHudUpdate(hudStateRef.current);
            }
            if (loadingDirtyRef.current && loadingStateRef.current) {
                loadingDirtyRef.current = false;
                onLoadingUpdate(loadingStateRef.current);
            }
            rafId = window.requestAnimationFrame(flush);
        };

        rafId = window.requestAnimationFrame(flush);
        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [onHudUpdate, onLoadingUpdate]);

    useEffect(() => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
    }, [gl]);

    useEffect(() => {
        if (!world || !rapier) {
            return;
        }

        physics.setWorld(rapier, world);
        const engine = new GameEngine({
            camera,
            canvas: gl.domElement,
            levelDef,
            netSession,
            onHudUpdate: queueHudUpdate,
            onLoadingUpdate: queueLoadingUpdate,
            onMissionComplete,
            physics,
            scene,
        });
        engineRef.current = engine;

        let cancelled = false;
        engine
            .init()
            .then(() => {
                if (!cancelled) {
                    setEcsWorld(engine.getWorld());
                    setEnemyIds(engine.getEnemyEntityIds());
                    setPickupEntities(engine.getPickupEntities());
                    const params = new URLSearchParams(window.location.search);
                    if (import.meta.env.DEV || params.has('e2e')) {
                        (window as Window & { __gtDebug?: unknown }).__gtDebug = {
                            getPointerLockState: () => engine.debugGetPointerLockState(),
                            getWeaponAnimations: () => engine.debugGetWeaponAnimations(),
                            getWeaponTransform: () => engine.debugGetViewModelState(),
                            playWeaponAnimation: (animation: string) => engine.debugPlayWeaponAnimation(animation),
                            poseWeaponClip: (clipName: string, time?: number) =>
                                engine.debugPoseWeaponClip(clipName, time),
                            setPointerLockState: (locked: boolean) => engine.debugSetPointerLockState(locked),
                            setWeapon: async (weaponId: WeaponIdType) => engine.debugSetWeapon(weaponId),
                            setWeaponTransform: (transform: {
                                position?: [number, number, number];
                                rotation?: [number, number, number];
                                scale?: number;
                            }) => engine.debugSetViewModelTransform(transform),
                        };
                    }
                }
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) {
                    queueLoadingUpdate({
                        progress: 100,
                        status: 'Failed to load game. Please refresh the page.',
                        visible: true,
                    });
                }
            })
            .finally(() => {
                if (cancelled) {
                    engine.dispose();
                }
            });

        return () => {
            cancelled = true;
            engineRef.current?.dispose();
            engineRef.current = null;
        };
    }, [
        world,
        rapier,
        physics,
        camera,
        scene,
        gl,
        levelDef,
        netSession,
        onMissionComplete,
        queueHudUpdate,
        queueLoadingUpdate,
    ]);

    useEffect(() => {
        if (!netSession) {
            setRemotePlayers([]);
            return;
        }

        const interval = window.setInterval(() => {
            const engine = engineRef.current;
            if (!engine) {
                return;
            }

            const nextPlayers = engine.getRemotePlayers();
            setRemotePlayers((prev) => (areRemotePlayersEqual(prev, nextPlayers) ? prev : nextPlayers));
        }, 50);

        return () => {
            window.clearInterval(interval);
        };
    }, [netSession]);

    useFrame((_state, delta) => {
        const engine = engineRef.current;
        if (!engine) {
            return;
        }
        engine.update(delta);
    });

    if (!ecsWorld) {
        return null;
    }

    return (
        <>
            {enemyIds.map((id) => (
                <EnemyEntity key={id} entityId={id} world={ecsWorld} />
            ))}
            <Suspense fallback={null}>
                {pickupEntities.map(({ entityId, pickupId }) => (
                    <PickupEntity key={entityId} entityId={entityId} pickupId={pickupId} world={ecsWorld} />
                ))}
            </Suspense>
            {remotePlayers.map((player) => (
                <RemotePlayerEntity key={player.id} player={player} />
            ))}
        </>
    );
};
