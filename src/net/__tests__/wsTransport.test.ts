import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWsTransport } from '../wsTransport';

class MockWebSocket {
    static instances: MockWebSocket[] = [];
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

    send(_data: string) {}

    close() {
        this.readyState = MockWebSocket.CLOSED;
    }
}

describe('createWsTransport', () => {
    const originalWebSocket = globalThis.WebSocket;

    afterEach(() => {
        MockWebSocket.instances = [];
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
});
