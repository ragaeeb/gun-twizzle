import type { NetEvent } from './types';

type EventHandler = (event: NetEvent) => void;

export class NetClient {
    private handlers = new Set<EventHandler>();

    connect() {
        throw new Error('NetClient.connect() is not implemented yet');
    }

    disconnect() {
        this.handlers.clear();
    }

    onEvent(handler: EventHandler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    send(_event: NetEvent) {
        throw new Error('NetClient.send() is not implemented yet');
    }
}
