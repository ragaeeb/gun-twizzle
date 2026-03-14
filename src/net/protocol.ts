/**
 * Network protocol — serializable message types for client↔server communication.
 * All types are plain JSON-safe (no Three.js, no Rapier).
 */

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number]; // [w, x, y, z]

// ─── Serializable Input ─────────────────────────────────────────────────

export type SerializedInput = {
    backward: boolean;
    /** Client-reported camera position for server-side hit validation. */
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
    weaponId: string;
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
    pickupId: string;
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

export const decodeClientMessage = (raw: string): ClientMessage => JSON.parse(raw) as ClientMessage;

export const decodeServerMessage = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
