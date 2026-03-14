import { describe, expect, it } from 'vitest';

import { initialInputFlags, reduceInput } from '../src/runtime/input-state';

describe('reduceInput', () => {
    it('toggles key flags correctly', () => {
        let state = reduceInput(initialInputFlags, {
            key: 'forward',
            type: 'keyDown',
        });

        expect(state.forward).toBe(true);
        expect(state.backward).toBe(false);
        expect(state.left).toBe(false);
        expect(state.right).toBe(false);
        expect(state.jump).toBe(false);

        state = reduceInput(state, { key: 'forward', type: 'keyUp' });
        expect(state.forward).toBe(false);
    });

    it('toggles backward flag without affecting others', () => {
        let state = reduceInput(initialInputFlags, { key: 'backward', type: 'keyDown' });

        expect(state.backward).toBe(true);
        expect(state.forward).toBe(false);
        expect(state.left).toBe(false);
        expect(state.right).toBe(false);
        expect(state.jump).toBe(false);

        state = reduceInput(state, { key: 'backward', type: 'keyUp' });
        expect(state.backward).toBe(false);
    });

    it('toggles left flag without affecting others', () => {
        let state = reduceInput(initialInputFlags, { key: 'left', type: 'keyDown' });

        expect(state.left).toBe(true);
        expect(state.forward).toBe(false);
        expect(state.backward).toBe(false);
        expect(state.right).toBe(false);
        expect(state.jump).toBe(false);

        state = reduceInput(state, { key: 'left', type: 'keyUp' });
        expect(state.left).toBe(false);
    });

    it('toggles right flag without affecting others', () => {
        let state = reduceInput(initialInputFlags, { key: 'right', type: 'keyDown' });

        expect(state.right).toBe(true);
        expect(state.forward).toBe(false);
        expect(state.backward).toBe(false);
        expect(state.left).toBe(false);
        expect(state.jump).toBe(false);

        state = reduceInput(state, { key: 'right', type: 'keyUp' });
        expect(state.right).toBe(false);
    });

    it('toggles jump flag without affecting others', () => {
        let state = reduceInput(initialInputFlags, { key: 'jump', type: 'keyDown' });

        expect(state.jump).toBe(true);
        expect(state.forward).toBe(false);
        expect(state.backward).toBe(false);
        expect(state.left).toBe(false);
        expect(state.right).toBe(false);

        state = reduceInput(state, { key: 'jump', type: 'keyUp' });
        expect(state.jump).toBe(false);
    });

    it('resets all flags to initial state', () => {
        let state = reduceInput(initialInputFlags, { key: 'forward', type: 'keyDown' });
        state = reduceInput(state, { key: 'jump', type: 'keyDown' });

        state = reduceInput(state, { type: 'reset' });

        expect(state).toEqual(initialInputFlags);
    });
});
