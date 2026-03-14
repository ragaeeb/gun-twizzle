export type InputFlags = {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
};

export type InputAction =
    | { type: 'keyDown'; key: keyof InputFlags }
    | { type: 'keyUp'; key: keyof InputFlags }
    | { type: 'reset' };

export const initialInputFlags: InputFlags = {
    backward: false,
    forward: false,
    jump: false,
    left: false,
    right: false,
};

export function reduceInput(state: InputFlags, action: InputAction): InputFlags {
    switch (action.type) {
        case 'keyDown':
            return { ...state, [action.key]: true };
        case 'keyUp':
            return { ...state, [action.key]: false };
        case 'reset':
            return { ...initialInputFlags };
        default:
            return state;
    }
}
