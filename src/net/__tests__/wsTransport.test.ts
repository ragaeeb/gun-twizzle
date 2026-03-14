import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWsTransport } from '../wsTransport';

class MockWebSocket {
    static instances: MockWebSocket[] = [];
    static sendCallCount = 0;
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    url: string;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(_data: string) {
        MockWebSocket.sendCallCount += 1;
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
    }
}

describe('createWsTransport', () => {
    const originalWebSocket = globalThis.WebSocket;

    afterEach(() => {
        MockWebSocket.instances = [];
        MockWebSocket.sendCallCount = 0;
        globalThis.WebSocket = originalWebSocket;
        vi.useRealTimers();
    });

    it('allows reconnecting after close', () => {
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

        const transport = createWsTransport({ url: 'ws://localhost:1234' });

        transport.connect();
        expect(MockWebSocket.instances.length).toBe(1);

        transport.close();
        transport.connect();
        expect(MockWebSocket.instances.length).toBe(2);
    });

    it('drops sends when not connected', () => {
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

        const transport = createWsTransport({ url: 'ws://localhost:1234' });

        transport.send({ name: 'player', type: 'c:join' });

        expect(MockWebSocket.instances.length).toBe(0);
        expect(MockWebSocket.sendCallCount).toBe(0);
    });

    it('invokes onMessage for valid server messages', () => {
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
        const onMessage = vi.fn();

        const transport = createWsTransport({ onMessage, url: 'ws://localhost:1234' });
        transport.connect();

        const socket = MockWebSocket.instances[0]!;
        socket.readyState = MockWebSocket.OPEN;
        socket.onmessage?.({ data: JSON.stringify({ playerId: 'p1', type: 's:playerLeave' }) } as MessageEvent);

        expect(onMessage).toHaveBeenCalledWith({ playerId: 'p1', type: 's:playerLeave' });
    });

    it('stops reconnecting after max attempts', () => {
        vi.useFakeTimers();
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

        const transport = createWsTransport({
            maxReconnectAttempts: 2,
            reconnectDelayMs: 10,
            url: 'ws://localhost:1234',
        });

        transport.connect();
        expect(MockWebSocket.instances.length).toBe(1);

        MockWebSocket.instances[0]!.readyState = MockWebSocket.CLOSED;
        MockWebSocket.instances[0]!.onclose?.();
        vi.advanceTimersByTime(10);
        expect(MockWebSocket.instances.length).toBe(2);

        MockWebSocket.instances[1]!.readyState = MockWebSocket.CLOSED;
        MockWebSocket.instances[1]!.onclose?.();
        vi.advanceTimersByTime(20);
        expect(MockWebSocket.instances.length).toBe(3);

        MockWebSocket.instances[2]!.readyState = MockWebSocket.CLOSED;
        MockWebSocket.instances[2]!.onclose?.();
        vi.advanceTimersByTime(40);
        expect(MockWebSocket.instances.length).toBe(3);
    });
});
