import type { NetEvent } from './types';

type EventHandler = (event: NetEvent) => void;

export class NetClient {
    private handlers = new Set<EventHandler>();

    connect() {
        // Placeholder for future Socket.IO connection.
    }

    disconnect() {
        this.handlers.clear();
    }

    onEvent(handler: EventHandler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    send(_event: NetEvent) {
        // Stub for outgoing events.
    }
}
