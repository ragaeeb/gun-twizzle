import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { AssetRegistry } from '../assets/registry';
import type { LevelDef } from '../content/levels/types';
import { getServerUrl } from '../net/config';
import { createNetSession, type NetSession } from '../net/session';
import { DevMetrics } from '../render/debug/DevMetrics';
import { PerfOverlay } from '../render/debug/PerfOverlay';
import { FpsCamera, GameScene } from '../render/scene';
import { PhysicsSystem } from '../runtime/physics';
import type { HudState, LoadingState } from '../runtime/types';
import { Hud } from '../ui/Hud';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { GameRuntime } from './GameRuntime';
import { PointerLockOverlay } from './PointerLockOverlay';

const initialHudState: HudState = {
    ammo: 0,
    health: 100,
    healthMax: 100,
    hudImage: AssetRegistry.hud.usp,
    isReloading: false,
    magazineSize: 1,
    missionText: '',
    totalAmmo: 0,
    weaponId: null,
    weaponName: '',
};

const initialLoadingState: LoadingState = {
    progress: 0,
    status: 'Initializing...',
    visible: true,
};

type GameSessionProps = {
    levelDef: LevelDef;
    onMissionComplete: () => void;
    onPlayerDefeated: () => void;
};

export const GameSession = ({ levelDef, onMissionComplete, onPlayerDefeated }: GameSessionProps) => {
    const [hudState, setHudState] = useState<HudState>(initialHudState);
    const [loadingState, setLoadingState] = useState<LoadingState>(initialLoadingState);
    const [camera] = useState(() => new FpsCamera());
    const [physics] = useState(() => new PhysicsSystem());
    const [scene] = useState(() => new GameScene());
    const defeatHandledRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Multiplayer: create a NetSession only when VITE_MULTIPLAYER_URL is set.
    // When absent (e.g. Vercel deploy), this is null and the game is pure offline.
    const netSession = useMemo<NetSession | undefined>(() => {
        const url = getServerUrl();
        if (!url) {
            return undefined;
        }
        return createNetSession(url, 'Player');
    }, []);

    useEffect(() => {
        return () => {
            netSession?.destroy();
        };
    }, [netSession]);

    useEffect(() => {
        if (hudState.health > 0 || defeatHandledRef.current) {
            return;
        }

        defeatHandledRef.current = true;
        document.exitPointerLock?.();
        onPlayerDefeated();
    }, [hudState.health, onPlayerDefeated]);

    return (
        <div className="app">
            <ErrorBoundary
                fallback={
                    <div className="error-screen">
                        <h1>Rendering error</h1>
                        <p>The 3D engine encountered an error. Please refresh.</p>
                    </div>
                }
            >
                <Canvas
                    camera={camera}
                    scene={scene}
                    shadows={{ type: THREE.PCFShadowMap }}
                    onCreated={({ gl }) => {
                        canvasRef.current = gl.domElement;
                    }}
                >
                    <Physics gravity={[0, -9.81, 0]}>
                        <GameRuntime
                            camera={camera}
                            levelDef={levelDef}
                            netSession={netSession}
                            physics={physics}
                            scene={scene}
                            onHudUpdate={setHudState}
                            onLoadingUpdate={setLoadingState}
                            onMissionComplete={onMissionComplete}
                        />
                        <PerfOverlay />
                        <DevMetrics />
                    </Physics>
                </Canvas>
            </ErrorBoundary>
            <Hud state={hudState} />
            <LoadingScreen state={loadingState} />
            <PointerLockOverlay canvasRef={canvasRef} />
        </div>
    );
};
