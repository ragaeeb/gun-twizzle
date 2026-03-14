import { describe, expect, it } from 'vitest';

import { createComponentStore } from '../world';

describe('ComponentStore', () => {
    it('stores and retrieves values by entity id', () => {
        const store = createComponentStore<number>();
        store.set(1, 42);
        expect(store.get(1)).toBe(42);
    });

    it('returns undefined for missing entity', () => {
        const store = createComponentStore<number>();
        expect(store.get(999)).toBeUndefined();
    });

    it('deletes entries', () => {
        const store = createComponentStore<number>();
        store.set(1, 42);
        store.delete(1);
        expect(store.has(1)).toBe(false);
        expect(store.get(1)).toBeUndefined();
    });

    it('iterates over all entries', () => {
        const store = createComponentStore<string>();
        store.set(1, 'a');
        store.set(2, 'b');
        store.set(3, 'c');

        const entries = [...store.entries()];
        expect(entries).toHaveLength(3);
        expect(entries.map(([id]) => id).sort()).toEqual([1, 2, 3]);
    });

    it('overwriting an entry replaces the value', () => {
        const store = createComponentStore<number>();
        store.set(1, 10);
        store.set(1, 20);
        expect(store.get(1)).toBe(20);
    });

    it('deleting a non-existent entity is a no-op', () => {
        const store = createComponentStore<number>();
        expect(() => store.delete(999)).not.toThrow();
    });
});
