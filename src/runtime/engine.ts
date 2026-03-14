import * as THREE from 'three';
import { AssetManager, AudioManager } from '../assets/gameAssets';
import { validateLoaderPrerequisites } from '../assets/loaders';
import { ENEMY_REGISTRY } from '../content/enemies/definitions';
import type { LevelDef, PickupId } from '../content/levels/types';
import type { SerializedInput, WorldSnapshot } from '../net/protocol';
import type { NetSession } from '../net/session';
import type { FpsCamera, GameScene } from '../render/scene';
import type { SimClock } from '../sim/clock';
import { createClock, tickClock } from '../sim/clock';
import type { DamageEvent, EventQueue, SimEvent } from '../sim/events';
import { createEventQueue, swapEventBuffers } from '../sim/events';
import { aiSystem } from '../sim/systems/aiSystem';
import { applyDamageSystem } from '../sim/systems/damageSystem';
import { processHitScanResult } from '../sim/systems/hitScanSystem';
import { createMissionState, type MissionState, missionSystem } from '../sim/systems/missionSystem';
import { AMMO_RESTORE, pickupSystem } from '../sim/systems/pickupSystem';
import { spawnEnemy } from '../sim/systems/spawnSystem';
import { applyShieldRegen, statusEffectSystem } from '../sim/systems/statusEffectSystem';
import type { EntityId, World } from '../sim/world';
import { addTag, createEntity, createWorld } from '../sim/world';
import { findClosestEnemyHit, getSimWeaponDefForGameWeapon } from './enemyHitDetection';
import { InputController } from './input';
import type { PhysicsSystem } from './physics';
import { PlayerController, WeaponSystem } from './player';
import type { HudState, InputState, LoadingState, RemotePlayerState, WeaponDefinition, WeaponId } from './types';

type GameEngineOptions = {
    camera: FpsCamera;
    canvas: HTMLCanvasElement;
    levelDef: LevelDef;
    /** When provided, the engine runs in online mode with prediction/reconciliation. */
    netSession?: NetSession;
    onHudUpdate?: (state: HudState) => void;
    onLoadingUpdate?: (state: LoadingState) => void;
    onMissionComplete?: () => void;
    physics: PhysicsSystem;
    scene: GameScene;
};

export class GameEngine {
    private static readonly ENEMY_FIRE_REF_DISTANCE = 10;
    private static readonly ENEMY_FIRE_ROLLOFF = 1.5;
    private static readonly PLAYER_HIT_SHAKE_BASE = 0.16;
    private static readonly PLAYER_HIT_SHAKE_SCALE = 0.012;
    private static readonly PLAYER_HIT_SHAKE_MAX = 0.42;
    private camera: FpsCamera;
    private scene: GameScene;
    private physics: PhysicsSystem;
    private canvas: HTMLCanvasElement;
    private onHudUpdate?: (state: HudState) => void;
    private onLoadingUpdate?: (state: LoadingState) => void;
    private onMissionComplete?: () => void;
    private input: InputController | null = null;
    private player: PlayerController | null = null;
    private weaponSystem: WeaponSystem | null = null;
    private ready = false;
    private totalSteps = 0;
    private currentStep = 0;
    private loadingState: LoadingState = {
        progress: 0,
        status: 'Initializing...',
        visible: true,
    };
    private lastHudState: HudState | null = null;
    private loadingTimeout: number | null = null;
    private clock: SimClock;
    private eventQueue: EventQueue;

    // ECS World
    private world: World;
    private playerEntityId: EntityId | null = null;
    private enemyEntityIds: EntityId[] = [];
    private pickupEntityIds: EntityId[] = [];
    private missionState: MissionState;
    private simTime = 0;
    private levelDef: LevelDef;
    private missionCompleteEmitted = false;
    private missionCompleteTimeout: number | null = null;
    private lastPlayerHealth: number | null = null;
    private readonly playerSpawnPosition: THREE.Vector3;
    private readonly cameraQuat = new THREE.Quaternion();
    private readonly camDir = new THREE.Vector3();

    // Multiplayer (null = offline mode, present = online mode)
    private netSession: NetSession | null = null;
    private remotePlayers: RemotePlayerState[] = [];

    constructor(options: GameEngineOptions) {
        this.camera = options.camera;
        this.scene = options.scene;
        this.physics = options.physics;
        this.canvas = options.canvas;
        this.onHudUpdate = options.onHudUpdate;
        this.onLoadingUpdate = options.onLoadingUpdate;
        this.onMissionComplete = options.onMissionComplete;
        this.levelDef = options.levelDef;
        this.netSession = options.netSession ?? null;
        this.clock = createClock(60);
        this.eventQueue = createEventQueue();
        this.world = createWorld();
        const firstMission = options.levelDef.missions[0];
        const mission =
            firstMission ??
            ({
                params: { count: options.levelDef.enemies.length },
                type: 'kill_count',
            } as LevelDef['missions'][number]);
        this.missionState = createMissionState(mission);
        this.playerSpawnPosition = new THREE.Vector3(
            options.levelDef.playerSpawn.x,
            options.levelDef.playerSpawn.y,
            options.levelDef.playerSpawn.z,
        );
    }

    /** Whether the engine is running in online (multiplayer) mode. */
    get isOnline(): boolean {
        return this.netSession !== null;
    }

    /** The sim world — exposed for the render layer to read entity positions. */
    getWorld(): World {
        return this.world;
    }

    /** Active enemy entity IDs — exposed for the render layer. */
    getEnemyEntityIds(): EntityId[] {
        return this.enemyEntityIds;
    }

    /** Remote player states — exposed for the render layer. */
    getRemotePlayers(): RemotePlayerState[] {
        return this.remotePlayers;
    }

    /** Debug helper for tests/devtools: force the equipped weapon. */
    async debugSetWeapon(weaponId: WeaponId) {
        this.player?.debugSetWeapon(weaponId);
        await this.weaponSystem?.debugSetWeapon(weaponId);
        this.updateHud();
    }

    debugSetViewModelTransform(transform: {
        position?: [number, number, number];
        rotation?: [number, number, number];
        scale?: number;
    }) {
        this.weaponSystem?.debugSetViewModelTransform(transform);
    }

    debugGetViewModelState() {
        return this.weaponSystem?.debugGetViewModelState() ?? null;
    }

    debugPlayWeaponAnimation(animation: string) {
        this.weaponSystem?.debugPlayWeaponAnimation(animation);
    }

    debugGetWeaponAnimations() {
        return this.weaponSystem?.debugGetWeaponAnimations() ?? [];
    }

    debugPoseWeaponClip(clipName: string, time = 0) {
        return this.weaponSystem?.debugPoseWeaponClip(clipName, time) ?? false;
    }

    debugSetPointerLockState(locked: boolean) {
        this.input?.debugSetPointerLockState(locked);
    }

    debugGetPointerLockState() {
        return this.input?.debugGetPointerLockState() ?? false;
    }

    /** Pickup entity IDs with pickup type info for rendering. */
    getPickupEntities(): Array<{ entityId: EntityId; pickupId: PickupId }> {
        const result: Array<{ entityId: EntityId; pickupId: PickupId }> = [];
        for (const [id, pickup] of this.world.pickup.entries()) {
            result.push({ entityId: id, pickupId: pickup.pickupId });
        }
        return result;
    }

    async init() {
        this.initLoading(10);

        this.updateStep('Validating loader prerequisites...');
        await validateLoaderPrerequisites();

        this.updateStep('Loading weapon models...');
        await AssetManager.initializeWeapons();

        this.updateStep('Initializing game scene...');
        this.scene.initialize(this.levelDef);
        this.scene.attachCamera(this.camera);

        this.updateStep('Initializing audio system...');
        await AudioManager.init(this.camera);

        this.updateStep('Loading game audio...');
        await AudioManager.loadGameAudio();
        AudioManager.playSoundscape(this.levelDef.ambientSoundKey);

        this.updateStep('Creating player...');
        this.player = new PlayerController(this.physics, this.camera, this.playerSpawnPosition);
        this.initPlayerEntity();

        this.updateStep('Spawning level...');
        this.spawnLevel();

        this.updateStep('Setting up weapon system...');
        this.weaponSystem = new WeaponSystem(this.camera, this.player, this.scene);

        this.updateStep('Initializing input...');
        this.input = new InputController(this.canvas, this.camera);

        this.updateStep('Starting rendering...');
        this.ready = true;
        this.finishLoading();
    }

    private initPlayerEntity() {
        const id = createEntity(this.world);
        this.playerEntityId = id;

        const spawn = this.levelDef.playerSpawn;
        this.world.transform.set(id, {
            position: { ...spawn },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
        });
        this.world.health.set(id, {
            current: 100,
            max: 100,
            shieldCurrent: 0,
            shieldMax: 0,
            shieldRechargeDelay: 0,
        });
        this.world.weaponOwner.set(id, {
            ammo: {
                ak47: { magazine: 30, reserve: 90 },
                knife: { magazine: 1, reserve: 0 },
            },
            equippedWeaponId: 'ak47',
        });
        addTag(this.world, id, 'player');
    }

    private spawnLevel() {
        this.logLevelSpawnLayout();

        // Spawn enemies
        for (const enemySpawn of this.levelDef.enemies) {
            const def = ENEMY_REGISTRY[enemySpawn.enemyDefId];
            if (!def) {
                continue;
            }
            const id = spawnEnemy(this.world, def, enemySpawn.position, enemySpawn.patrolPath, enemySpawn.spawnId);
            this.enemyEntityIds.push(id);

            // Boss: double health
            if (enemySpawn.spawnId === 'boss') {
                const health = this.world.health.get(id);
                if (health) {
                    health.current *= 2;
                    health.max *= 2;
                }
            }
        }

        // Spawn pickups
        for (const pickupSpawn of this.levelDef.pickups) {
            const id = createEntity(this.world);
            this.world.transform.set(id, {
                position: { ...pickupSpawn.position },
                rotation: { w: 1, x: 0, y: 0, z: 0 },
            });
            this.world.pickup.set(id, {
                pickupId: pickupSpawn.pickupId,
                respawnAt: null,
            });
            addTag(this.world, id, 'pickup');
            this.pickupEntityIds.push(id);
        }

        // Build greybox level geometry
        this.buildLevelGeometry();
    }

    private logLevelSpawnLayout() {
        if (!import.meta.env.DEV) {
            return;
        }

        console.groupCollapsed(`[Level Layout] ${this.levelDef.name} (${this.levelDef.id})`);
        console.info('playerSpawn', this.levelDef.playerSpawn);
        console.table(
            this.levelDef.enemies.map((enemy, index) => ({
                enemyDefId: enemy.enemyDefId,
                index,
                patrolPath: enemy.patrolPath?.map((point) => `(${point.x}, ${point.y}, ${point.z})`).join(' -> ') ?? '',
                position: `(${enemy.position.x}, ${enemy.position.y}, ${enemy.position.z})`,
                spawnId: enemy.spawnId ?? '',
            })),
        );
        console.table(
            this.levelDef.pickups.map((pickup, index) => ({
                index,
                pickupId: pickup.pickupId,
                position: `(${pickup.position.x}, ${pickup.position.y}, ${pickup.position.z})`,
            })),
        );
        console.info('wallCount', this.levelDef.walls.length);
        console.groupEnd();
    }

    private buildLevelGeometry() {
        // Ground plane with physics
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({ color: this.levelDef.groundColor, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.physics.createGround(200, 200);

        // Walls with physics colliders
        for (const wallDef of this.levelDef.walls) {
            const geo = new THREE.BoxGeometry(wallDef.size.width, wallDef.size.height, wallDef.size.depth);
            const mat = new THREE.MeshStandardMaterial({ color: wallDef.color, roughness: 0.8 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(wallDef.position.x, wallDef.position.y, wallDef.position.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            this.physics.createBox(
                wallDef.size.width,
                wallDef.size.height,
                wallDef.size.depth,
                new THREE.Vector3(wallDef.position.x, wallDef.position.y, wallDef.position.z),
                true,
            );
        }
    }

    update(delta: number) {
        if (!this.ready || !this.input || !this.player || !this.weaponSystem) {
            return;
        }

        if (this.shouldPauseSinglePlayer()) {
            return;
        }

        // Apply pending server snapshot before running local ticks (reconciliation)
        if (this.netSession) {
            this.applyPendingSnapshot();
        }

        // Run fixed-step simulation ticks
        const steps = tickClock(this.clock, delta);

        // Capture input once per frame (shared across all sub-steps)
        this.input.updateKeyEvents();
        const mouseMovement = this.input.getMouseMovement();

        for (let i = 0; i < steps; i++) {
            this.simulationTick(this.clock.dt);
            swapEventBuffers(this.eventQueue);
            this.processEvents();
        }

        // Visual-only updates run once per render frame
        this.camera.setSprintFov(this.player.isSprinting);
        this.camera.update(delta);
        this.scene.update(delta, this.camera);
        this.weaponSystem.update(delta, mouseMovement);

        this.updateHud();
    }

    private shouldPauseSinglePlayer() {
        return !this.netSession && !this.input?.isPointerLocked;
    }

    private simulationTick(dt: number) {
        if (!this.input || !this.player || !this.weaponSystem) {
            return;
        }

        if (import.meta.env.DEV) {
            performance.mark('sim-tick-start');
        }

        this.simTime += dt;

        const weaponResult = this.processPlayerInput(dt);
        this.syncPlayerToECS();

        if (this.netSession) {
            this.sendInputToServer(dt);
        }

        this.runLocalSimulation(weaponResult.hasShoot, dt);

        if (this.physics.isReady()) {
            this.physics.syncMeshes();
        }

        if (import.meta.env.DEV) {
            performance.mark('sim-tick-end');
            performance.measure('sim:tick', 'sim-tick-start', 'sim-tick-end');
        }

        if (this.player.getPosition().y < -10) {
            this.player.setPosition(this.playerSpawnPosition.clone());
            this.player.setVelocity(new THREE.Vector3(0, 0, 0));
        }
    }

    /**
     * Run local simulation systems for immediate gameplay feedback.
     * In online mode, AI is driven by server snapshots, but hit detection,
     * damage, pickups, status effects, and missions run locally.
     * Server snapshots override authoritative state each tick.
     */
    private runLocalSimulation(hasShoot: boolean, dt: number) {
        const outEvents: SimEvent[] = this.eventQueue.write;

        if (hasShoot) {
            this.checkEnemyHits(outEvents);
        }

        this.runSystems(dt, outEvents);
    }

    /** Online mode: serialize and send input to server, record for reconciliation. */
    private sendInputToServer(_dt: number) {
        if (!this.netSession || !this.input || !this.player) {
            return;
        }

        const keys = this.input.getKeys();
        const quat = this.camera.getWorldQuaternion(this.cameraQuat);

        const camPos = this.camera.position;
        const serialized: SerializedInput = {
            backward: keys.backward,
            cameraPosition: [camPos.x, camPos.y, camPos.z],
            crouch: keys.crouch,
            forward: keys.forward,
            jump: keys.jump,
            left: keys.left,
            lookRotation: [quat.w, quat.x, quat.y, quat.z],
            reload: this.input.isKeyDown('r'),
            right: keys.right,
            shoot: this.input.isMouseButtonPressed(0),
            sprint: keys.sprint,
            switchWeapon: null,
        };

        const seq = this.netSession.sendInput(serialized);
        const pos = this.player.getPosition();
        this.netSession.recordInput(seq, serialized, [pos.x, pos.y, pos.z]);
    }

    /** Apply the latest server snapshot: reconcile local player, update remote entities. */
    private applyPendingSnapshot() {
        if (!this.netSession || !this.player) {
            return;
        }

        const pending = this.netSession.popSnapshot();
        if (!pending) {
            return;
        }

        this.reconcileFromSnapshot(pending.snapshot);
        this.updateRemoteEntities(pending.snapshot);
        this.updateRemotePickups(pending.snapshot);
        this.updateRemotePlayers(pending.snapshot);
    }

    private reconcileFromSnapshot(snapshot: WorldSnapshot) {
        if (!this.netSession || !this.player || !this.playerEntityId) {
            return;
        }

        const localId = this.netSession.playerId();
        const serverPlayer = snapshot.players.find((p) => p.id === localId);
        if (!serverPlayer) {
            return;
        }

        // Apply server-authoritative health
        const health = this.world.health.get(this.playerEntityId);
        if (health) {
            health.current = serverPlayer.health;
        }

        // Position reconciliation is disabled for M6 foundation because the server
        // uses simplified kinematic movement (no Rapier, no gravity) while the client
        // runs full Rapier physics. Snapping to the server position every frame causes
        // violent Y-axis oscillation as the client falls and gets snapped back up.
        // Client prediction handles local player position; server is authoritative
        // only for health and remote entity state.
    }

    private updateRemoteEntities(snapshot: WorldSnapshot) {
        for (let i = 0; i < snapshot.enemies.length; i++) {
            const enemy = snapshot.enemies[i];
            const clientEntityId = this.enemyEntityIds[i];
            if (clientEntityId === undefined || !enemy) {
                continue;
            }

            const transform = this.world.transform.get(clientEntityId);
            if (transform) {
                transform.position.x = enemy.position[0];
                transform.position.y = enemy.position[1];
                transform.position.z = enemy.position[2];
                transform.rotation.w = enemy.rotation[0];
                transform.rotation.x = enemy.rotation[1];
                transform.rotation.y = enemy.rotation[2];
                transform.rotation.z = enemy.rotation[3];
            }

            const health = this.world.health.get(clientEntityId);
            if (health) {
                health.current = enemy.health;
            }

            const ai = this.world.ai.get(clientEntityId);
            if (ai && enemy.state !== ai.state) {
                ai.state = enemy.state as typeof ai.state;
            }
        }
    }

    private updateRemotePickups(snapshot: WorldSnapshot) {
        for (let i = 0; i < snapshot.pickups.length; i++) {
            const serverPickup = snapshot.pickups[i];
            const clientEntityId = this.pickupEntityIds[i];
            if (clientEntityId === undefined || !serverPickup) {
                continue;
            }

            const pickup = this.world.pickup.get(clientEntityId);
            if (!pickup) {
                continue;
            }

            if (serverPickup.active) {
                pickup.respawnAt = null;
            } else if (pickup.respawnAt === null) {
                pickup.respawnAt = this.simTime + 1;
            }
        }
    }

    private updateRemotePlayers(snapshot: WorldSnapshot) {
        if (!this.netSession) {
            return;
        }

        const localId = this.netSession.playerId();
        this.remotePlayers = snapshot.players
            .filter((p) => p.id !== localId)
            .map((p) => ({
                health: p.health,
                id: p.id,
                position: p.position,
                rotation: p.rotation,
                stance: p.stance,
                weaponId: p.weaponId,
            }));
    }

    private processPlayerInput(dt: number) {
        const isShooting = this.input!.isMouseButtonPressed(0);
        const isReloading = this.input!.isKeyDown('r');
        const wantsSprint = this.input!.getKeys().sprint && !isShooting && !isReloading;

        const playerInput: InputState = {
            backward: this.input!.getKeys().backward,
            crouch: this.input!.getKeys().crouch,
            deltaTime: dt,
            forward: this.input!.getKeys().forward,
            jump: this.input!.getKeys().jump,
            left: this.input!.getKeys().left,
            lookingRotationQuat: this.camera.getWorldQuaternion(this.cameraQuat),
            reload: isReloading,
            right: this.input!.getKeys().right,
            shoot: isShooting,
            sprint: wantsSprint,
            switchToKnife: this.input!.isKeyDown('three'),
            switchToPrimary: this.input!.isKeyDown('one'),
            switchToSecondary: this.input!.isKeyDown('two'),
        };

        const weaponResult = this.player!.processInput(playerInput, this.simTime * 1000);
        this.scene.updateLightPosition(this.player!.getPosition());
        this.weaponSystem!.processWeaponResult(weaponResult);
        return weaponResult;
    }

    private syncPlayerToECS() {
        if (this.playerEntityId === null) {
            return;
        }
        const pos = this.player!.getPosition();
        const transform = this.world.transform.get(this.playerEntityId);
        if (transform) {
            transform.position.x = pos.x;
            transform.position.y = pos.y;
            transform.position.z = pos.z;
        }
    }

    private runSystems(dt: number, outEvents: SimEvent[]) {
        // AI only runs locally in offline mode; in online mode server snapshots
        // drive enemy state via updateRemoteEntities().
        if (!this.netSession) {
            this.profileSystem('sim:ai', () => {
                aiSystem(this.world, this.playerEntityId, ENEMY_REGISTRY, dt, outEvents, this.levelDef.walls);
            });
        }

        const inEvents = outEvents.slice();
        const damageEvents: DamageEvent[] = [];
        for (const event of inEvents) {
            if (event.type === 'damage') {
                damageEvents.push(event);
            }
        }
        this.profileSystem('sim:damage', () => {
            applyDamageSystem(this.world, damageEvents, outEvents);
        });

        this.profileSystem('sim:pickup', () => {
            pickupSystem(this.world, this.playerEntityId, this.simTime, outEvents);
        });

        this.profileSystem('sim:status', () => {
            statusEffectSystem(this.world, dt);
            applyShieldRegen(this.world, dt);
        });

        this.profileSystem('sim:mission', () => {
            const missionEvents = outEvents.slice();
            missionSystem(this.missionState, missionEvents, outEvents, dt);
        });
    }

    private profileSystem(name: string, fn: () => void) {
        if (import.meta.env.DEV) {
            const startMark = `${name}-start`;
            const endMark = `${name}-end`;
            performance.mark(startMark);
            fn();
            performance.mark(endMark);
            performance.measure(name, startMark, endMark);
        } else {
            fn();
        }
    }

    private processEvents() {
        for (const event of this.eventQueue.read) {
            this.handleEvent(event);
        }

        this.checkMissionCompletion();
        // Drain read buffer so events aren't replayed on frames with 0 sim steps.
        this.eventQueue.read.length = 0;
    }

    private handleEvent(event: SimEvent) {
        switch (event.type) {
            case 'pickupCollected':
                this.handlePickupCollected(event);
                break;
            case 'playSound':
                this.handlePlaySound(event);
                break;
            default:
                break;
        }
    }

    private handlePickupCollected(event: SimEvent) {
        if (event.type !== 'pickupCollected' || !this.player) {
            return;
        }

        if (event.pickupId === 'ammo') {
            this.player.addAmmo(this.player.getCurrentWeaponId(), AMMO_RESTORE);
        }
    }

    private handlePlaySound(event: SimEvent) {
        if (event.type !== 'playSound') {
            return;
        }

        if (event.position) {
            AudioManager.playPositionalSFX(
                event.soundId,
                new THREE.Vector3(event.position.x, event.position.y, event.position.z),
                event.volume ?? 1,
                GameEngine.ENEMY_FIRE_REF_DISTANCE,
                GameEngine.ENEMY_FIRE_ROLLOFF,
            );
        } else {
            AudioManager.playSFX(event.soundId, event.volume ?? 1, false);
        }
    }

    private checkMissionCompletion() {
        if (!this.missionState.isComplete || this.missionCompleteEmitted) {
            return;
        }

        this.missionCompleteEmitted = true;
        // Delay to let the player see the "Mission Complete" text
        this.missionCompleteTimeout = window.setTimeout(() => {
            this.onMissionComplete?.();
            this.missionCompleteTimeout = null;
        }, 2000);
    }

    /**
     * Ray-sphere intersection test against all alive enemies.
     * Called when the player fires a weapon.
     */
    private checkEnemyHits(outEvents: SimEvent[]) {
        this.camera.getWorldDirection(this.camDir);
        const weaponId = this.player?.getCurrentWeaponId();
        if (!weaponId) {
            return;
        }

        const simWeaponDef = getSimWeaponDefForGameWeapon(weaponId);
        const hit = findClosestEnemyHit(
            this.world,
            { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
            { x: this.camDir.x, y: this.camDir.y, z: this.camDir.z },
            weaponId,
        );
        const damageEvent = hit ? processHitScanResult(hit, simWeaponDef) : null;

        if (damageEvent) {
            outEvents.push(damageEvent);
        }
    }

    dispose() {
        if (this.loadingTimeout !== null) {
            window.clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        if (this.missionCompleteTimeout !== null) {
            window.clearTimeout(this.missionCompleteTimeout);
            this.missionCompleteTimeout = null;
        }
        this.netSession?.destroy();
        this.netSession = null;
        this.input?.dispose();
        this.weaponSystem?.dispose();
        this.scene.decalSystem?.dispose();
        this.scene.impactParticle?.dispose();
        AudioManager.dispose();
        this.ready = false;
    }

    private initLoading(totalSteps: number) {
        this.totalSteps = totalSteps;
        this.currentStep = 0;
        this.updateLoading({
            progress: 0,
            status: 'Initializing...',
            visible: true,
        });
    }

    private updateStep(status: string) {
        this.currentStep += 1;
        const progress = this.totalSteps > 0 ? Math.min(100, (this.currentStep / this.totalSteps) * 100) : 0;
        this.updateLoading({ progress, status, visible: true });
    }

    private finishLoading() {
        this.updateLoading({ progress: 100, status: 'Ready!', visible: true });
        this.loadingTimeout = window.setTimeout(() => {
            this.updateLoading({ visible: false });
            this.loadingTimeout = null;
        }, 400);
    }

    private updateLoading(partial: Partial<LoadingState>) {
        this.loadingState = { ...this.loadingState, ...partial };
        this.onLoadingUpdate?.(this.loadingState);
    }

    private updateHud() {
        if (!this.player || !this.weaponSystem) {
            return;
        }

        const weaponState = this.weaponSystem.getCurrentWeaponState();
        const weaponDefinition = this.weaponSystem.getCurrentWeaponDefinition();
        const hudState = this.buildHudState(weaponDefinition, weaponState);
        if (!hudState) {
            return;
        }

        this.applyPlayerDamageFeedback(hudState.health);

        if (
            !this.lastHudState ||
            this.lastHudState.weaponId !== hudState.weaponId ||
            this.lastHudState.ammo !== hudState.ammo ||
            this.lastHudState.totalAmmo !== hudState.totalAmmo ||
            this.lastHudState.weaponName !== hudState.weaponName ||
            this.lastHudState.magazineSize !== hudState.magazineSize ||
            this.lastHudState.hudImage !== hudState.hudImage ||
            this.lastHudState.isReloading !== hudState.isReloading ||
            this.lastHudState.health !== hudState.health ||
            this.lastHudState.missionText !== hudState.missionText
        ) {
            this.lastHudState = hudState;
            this.onHudUpdate?.(hudState);
        }
    }

    private applyPlayerDamageFeedback(currentHealth: number) {
        if (this.lastPlayerHealth === null) {
            this.lastPlayerHealth = currentHealth;
            return;
        }

        if (currentHealth < this.lastPlayerHealth) {
            const damageTaken = this.lastPlayerHealth - currentHealth;
            const shakeIntensity = Math.min(
                GameEngine.PLAYER_HIT_SHAKE_MAX,
                GameEngine.PLAYER_HIT_SHAKE_BASE + damageTaken * GameEngine.PLAYER_HIT_SHAKE_SCALE,
            );

            this.camera.shake(shakeIntensity, 140);
            AudioManager.playSFX('crack', 0.75, false);
        }

        this.lastPlayerHealth = currentHealth;
    }

    private buildHudState(
        weaponDefinition: WeaponDefinition | undefined,
        weaponState: { weaponId: string; currentAmmo: number; totalAmmo: number; isReloading: boolean } | undefined,
    ): HudState | null {
        if (!weaponDefinition || !weaponState) {
            return null;
        }

        // Get player health from ECS world
        const playerHealth = this.playerEntityId !== null ? this.world.health.get(this.playerEntityId) : null;

        // Build mission text
        let missionText = '';
        if (this.missionState.isComplete) {
            missionText = '✓ Mission Complete';
        } else {
            switch (this.missionState.mission.type) {
                case 'kill_count':
                    missionText = `Eliminate hostiles: ${this.missionState.progress}/${this.missionState.mission.params.count}`;
                    break;
                case 'kill_target':
                    missionText = `Eliminate target: ${this.missionState.progress}/1`;
                    break;
                case 'survive_timer': {
                    const remainingSeconds = Math.max(
                        0,
                        this.missionState.mission.params.durationSeconds - this.missionState.elapsedSeconds,
                    );
                    missionText = `Survive: ${Math.ceil(remainingSeconds)}s`;
                    break;
                }
                case 'reach_trigger':
                    missionText = 'Reach the objective';
                    break;
                default:
                    missionText = '';
                    break;
            }
        }

        return {
            ammo: weaponState.currentAmmo,
            health: playerHealth?.current ?? 100,
            healthMax: playerHealth?.max ?? 100,
            hudImage: weaponDefinition.hudImagePath || '',
            isReloading: weaponState.isReloading,
            magazineSize: weaponDefinition.stats.magazineSize,
            missionText,
            totalAmmo: weaponState.totalAmmo,
            weaponId: weaponDefinition.id,
            weaponName: weaponDefinition.name,
        };
    }
}
