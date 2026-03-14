import { describe, expect, it } from 'vitest';

import { initialInputFlags, reduceInput } from '../src/runtime/input-state';

describe('reduceInput', () => {
    it('toggles key flags correctly', () => {
        let state = reduceInput(initialInputFlags, {
            key: 'forward',
            type: 'keyDown',
        });

        expect(state.forward).toBe(true);

        state = reduceInput(state, { key: 'forward', type: 'keyUp' });
        expect(state.forward).toBe(false);
    });
});
