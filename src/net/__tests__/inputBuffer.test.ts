import { describe, expect, it } from 'vitest';
import { type BufferedInput, createInputBuffer } from '../inputBuffer';

const makeInput = (seq: number): BufferedInput => ({
    input: {
        backward: false,
        cameraPosition: [0, 0, 0],
        crouch: false,
        forward: true,
        jump: false,
        left: false,
        lookRotation: [1, 0, 0, 0],
        reload: false,
        right: false,
        shoot: false,
        sprint: false,
        switchWeapon: null,
    },
    position: [seq, 0, 0],
    seq,
});

describe('InputBuffer', () => {
    it('starts empty', () => {
        const buf = createInputBuffer();
        expect(buf.count()).toBe(0);
        expect(buf.getUnacked()).toEqual([]);
    });

    it('pushes and returns entries in order', () => {
        const buf = createInputBuffer();
        buf.push(makeInput(1));
        buf.push(makeInput(2));
        buf.push(makeInput(3));

        expect(buf.count()).toBe(3);
        const entries = buf.getUnacked();
        expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    });

    it('ack removes entries up to and including the given seq', () => {
        const buf = createInputBuffer();
        buf.push(makeInput(1));
        buf.push(makeInput(2));
        buf.push(makeInput(3));
        buf.push(makeInput(4));

        buf.ack(2);
        expect(buf.count()).toBe(2);
        expect(buf.getUnacked().map((e) => e.seq)).toEqual([3, 4]);
    });

    it('ack with seq beyond all entries empties the buffer', () => {
        const buf = createInputBuffer();
        buf.push(makeInput(1));
        buf.push(makeInput(2));

        buf.ack(10);
        expect(buf.count()).toBe(0);
    });

    it('drops oldest entry when at capacity', () => {
        const buf = createInputBuffer(3);
        buf.push(makeInput(1));
        buf.push(makeInput(2));
        buf.push(makeInput(3));
        buf.push(makeInput(4));

        expect(buf.count()).toBe(3);
        expect(buf.getUnacked().map((e) => e.seq)).toEqual([2, 3, 4]);
    });

    it('getUnacked returns a copy (not a reference)', () => {
        const buf = createInputBuffer();
        buf.push(makeInput(1));

        const a = buf.getUnacked();
        const b = buf.getUnacked();
        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });
});
