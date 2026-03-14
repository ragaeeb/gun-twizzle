/**
 * Fixed-capacity ring buffer that stores recent inputs for client-side prediction.
 * When the server acknowledges an input seq, all entries up to that seq are discarded.
 * Remaining entries are re-applied during reconciliation.
 */

import type { SerializedInput } from './protocol';

export type BufferedInput = {
    input: SerializedInput;
    position: [number, number, number];
    seq: number;
};

const DEFAULT_CAPACITY = 128;

export type InputBuffer = {
    /** Acknowledge all inputs up to (and including) the given sequence number. */
    ack: (seq: number) => void;
    /** Number of unacknowledged entries currently in the buffer. */
    count: () => number;
    /** Return all unacknowledged entries in insertion order. */
    getUnacked: () => BufferedInput[];
    /** Push a new input entry. Silently drops the oldest if at capacity. */
    push: (entry: BufferedInput) => void;
};

export const createInputBuffer = (capacity = DEFAULT_CAPACITY): InputBuffer => {
    let entries: BufferedInput[] = [];

    return {
        ack: (seq: number) => {
            entries = entries.filter((e) => e.seq > seq);
        },

        count: () => entries.length,

        getUnacked: () => [...entries],

        push: (entry: BufferedInput) => {
            entries.push(entry);
            if (entries.length > capacity) {
                entries.shift();
            }
        },
    };
};
