import { TemplatedApp, WebSocket, HttpResponse } from 'uWebSockets.js';
import Limits from './limits';

export default class TibiaWebSocket {

    start = (app: TemplatedApp) => {
        app.ws('/*', {
            compression: 0,
            maxPayloadLength: 64 * 1024,
            idleTimeout: 10,
            open: this.onOpen,
            close: this.onClose,
            message: this.onMessage
        });
    }

    stop = () => {

    }

    private onOpen = (ws: WebSocket, req) => {
        if (!Limits.acceptConnection(Buffer.from(ws.getRemoteAddress()))) {
            return ws.close();
        }
        
    }

    private onClose = (ws, code, message) => {

    }

    private onMessage = (ws, message, isBinary) => {

    }
}