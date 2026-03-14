export type NetEvent =
    | { type: 'player:join'; id: string }
    | { type: 'player:leave'; id: string }
    | {
          type: 'player:state';
          id: string;
          position: [number, number, number];
          rotation: [number, number, number, number];
      }
    | { type: 'weapon:fire'; id: string; weaponId: string };

export type {
    ClientMessage,
    EnemySnapshot,
    PickupSnapshot,
    PlayerSnapshot,
    QuatTuple,
    SerializedInput,
    ServerMessage,
    Vec3Tuple,
    WorldSnapshot,
} from './protocol';
