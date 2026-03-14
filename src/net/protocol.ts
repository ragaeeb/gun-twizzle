import type { PickupId } from '../content/levels/types';
import { WeaponId } from '../runtime/types';

/**
 * Network protocol — serializable message types for client↔server communication.
 * All types are plain JSON-safe (no Three.js, no Rapier).
 */

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number]; // [w, x, y, z]

// ─── Serializable Input ─────────────────────────────────────────────────

export type SerializedInput = {
    backward: boolean;
    /** Client-reported camera position; currently used by server but should be non-authoritative. */
    cameraPosition: Vec3Tuple | null;
    crouch: boolean;
    forward: boolean;
    jump: boolean;
    left: boolean;
    lookRotation: QuatTuple;
    reload: boolean;
    right: boolean;
    shoot: boolean;
    sprint: boolean;
    switchWeapon: string | null;
};

// ─── Client → Server ────────────────────────────────────────────────────

export type ClientJoinMsg = {
    name: string;
    type: 'c:join';
};

export type ClientInputMsg = {
    input: SerializedInput;
    seq: number;
    type: 'c:input';
};

export type ClientMessage = ClientInputMsg | ClientJoinMsg;

// ─── Snapshot Payloads ──────────────────────────────────────────────────

export type PlayerSnapshot = {
    health: number;
    id: string;
    position: Vec3Tuple;
    rotation: QuatTuple;
    stance: string;
    weaponId: WeaponId;
};

export type EnemySnapshot = {
    entityId: number;
    health: number;
    position: Vec3Tuple;
    rotation: QuatTuple;
    state: string;
};

export type PickupSnapshot = {
    active: boolean;
    entityId: number;
    pickupId: PickupId;
    position: Vec3Tuple;
};

export type WorldSnapshot = {
    enemies: EnemySnapshot[];
    pickups: PickupSnapshot[];
    players: PlayerSnapshot[];
};

// ─── Server → Client ────────────────────────────────────────────────────

export type ServerWelcomeMsg = {
    levelId: string;
    playerId: string;
    snapshot: WorldSnapshot;
    tick: number;
    type: 's:welcome';
};

export type ServerSnapshotMsg = {
    lastInputSeq: Record<string, number>;
    snapshot: WorldSnapshot;
    tick: number;
    type: 's:snapshot';
};

export type ServerPlayerJoinMsg = {
    playerId: string;
    slot: number;
    type: 's:playerJoin';
};

export type ServerPlayerLeaveMsg = {
    playerId: string;
    type: 's:playerLeave';
};

export type ServerHitConfirmMsg = {
    damage: number;
    isHeadshot: boolean;
    shooterId: string;
    targetId: number;
    type: 's:hitConfirm';
};

export type ServerMessage =
    | ServerHitConfirmMsg
    | ServerPlayerJoinMsg
    | ServerPlayerLeaveMsg
    | ServerSnapshotMsg
    | ServerWelcomeMsg;

// ─── Helpers ────────────────────────────────────────────────────────────

export const encodeMessage = (msg: ClientMessage | ServerMessage): string => JSON.stringify(msg);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isVec3 = (value: unknown): value is Vec3Tuple =>
    Array.isArray(value) && value.length === 3 && value.every((entry) => isFiniteNumber(entry));

const isQuat = (value: unknown): value is QuatTuple =>
    Array.isArray(value) && value.length === 4 && value.every((entry) => isFiniteNumber(entry));

export const isSerializedInput = (value: unknown): value is SerializedInput => {
    if (!isObject(value)) {
        return false;
    }
    return (
        typeof value.backward === 'boolean' &&
        (value.cameraPosition === null || isVec3(value.cameraPosition)) &&
        typeof value.crouch === 'boolean' &&
        typeof value.forward === 'boolean' &&
        typeof value.jump === 'boolean' &&
        typeof value.left === 'boolean' &&
        isQuat(value.lookRotation) &&
        typeof value.reload === 'boolean' &&
        typeof value.right === 'boolean' &&
        typeof value.shoot === 'boolean' &&
        typeof value.sprint === 'boolean' &&
        (value.switchWeapon === null || typeof value.switchWeapon === 'string')
    );
};

const isClientJoinMsg = (value: unknown): value is ClientJoinMsg =>
    isObject(value) && value.type === 'c:join' && typeof value.name === 'string';

const isClientInputMsg = (value: unknown): value is ClientInputMsg =>
    isObject(value) && value.type === 'c:input' && isFiniteNumber(value.seq) && isSerializedInput(value.input);

const isClientMessage = (value: unknown): value is ClientMessage => isClientJoinMsg(value) || isClientInputMsg(value);

const isPlayerSnapshot = (value: unknown): value is PlayerSnapshot =>
    isObject(value) &&
    typeof value.health === 'number' &&
    typeof value.id === 'string' &&
    isVec3(value.position) &&
    isQuat(value.rotation) &&
    typeof value.stance === 'string' &&
    Object.values(WeaponId).includes(value.weaponId as WeaponId);

const isEnemySnapshot = (value: unknown): value is EnemySnapshot =>
    isObject(value) &&
    isFiniteNumber(value.entityId) &&
    isFiniteNumber(value.health) &&
    isVec3(value.position) &&
    isQuat(value.rotation) &&
    typeof value.state === 'string';

const isPickupSnapshot = (value: unknown): value is PickupSnapshot =>
    isObject(value) &&
    typeof value.active === 'boolean' &&
    isFiniteNumber(value.entityId) &&
    typeof value.pickupId === 'string' &&
    isVec3(value.position);

const isWorldSnapshot = (value: unknown): value is WorldSnapshot =>
    isObject(value) &&
    Array.isArray(value.enemies) &&
    value.enemies.every(isEnemySnapshot) &&
    Array.isArray(value.pickups) &&
    value.pickups.every(isPickupSnapshot) &&
    Array.isArray(value.players) &&
    value.players.every(isPlayerSnapshot);

const isServerWelcomeMsg = (value: unknown): value is ServerWelcomeMsg =>
    isObject(value) &&
    value.type === 's:welcome' &&
    typeof value.levelId === 'string' &&
    typeof value.playerId === 'string' &&
    isFiniteNumber(value.tick) &&
    isWorldSnapshot(value.snapshot);

const isRecordOfFiniteNumbers = (value: unknown): value is Record<string, number> => {
    if (!isObject(value)) {
        return false;
    }
    return Object.values(value).every(isFiniteNumber);
};

const isServerSnapshotMsg = (value: unknown): value is ServerSnapshotMsg =>
    isObject(value) &&
    value.type === 's:snapshot' &&
    isFiniteNumber(value.tick) &&
    isWorldSnapshot(value.snapshot) &&
    isRecordOfFiniteNumbers(value.lastInputSeq);

const isServerPlayerJoinMsg = (value: unknown): value is ServerPlayerJoinMsg =>
    isObject(value) &&
    value.type === 's:playerJoin' &&
    typeof value.playerId === 'string' &&
    isFiniteNumber(value.slot);

const isServerPlayerLeaveMsg = (value: unknown): value is ServerPlayerLeaveMsg =>
    isObject(value) && value.type === 's:playerLeave' && typeof value.playerId === 'string';

const isServerHitConfirmMsg = (value: unknown): value is ServerHitConfirmMsg =>
    isObject(value) &&
    value.type === 's:hitConfirm' &&
    isFiniteNumber(value.damage) &&
    typeof value.isHeadshot === 'boolean' &&
    typeof value.shooterId === 'string' &&
    isFiniteNumber(value.targetId);

const isServerMessage = (value: unknown): value is ServerMessage =>
    isServerWelcomeMsg(value) ||
    isServerSnapshotMsg(value) ||
    isServerPlayerJoinMsg(value) ||
    isServerPlayerLeaveMsg(value) ||
    isServerHitConfirmMsg(value);

const parseJson = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON: ${message}`);
    }
};

export const decodeClientMessage = (raw: string): ClientMessage => {
    const value = parseJson(raw);
    if (!isClientMessage(value)) {
        throw new Error('Invalid client message');
    }
    return value;
};

export const decodeServerMessage = (raw: string): ServerMessage => {
    const value = parseJson(raw);
    if (!isServerMessage(value)) {
        throw new Error('Invalid server message');
    }
    return value;
};
