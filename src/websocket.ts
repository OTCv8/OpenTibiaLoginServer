import { TemplatedApp, WebSocket, HttpResponse } from 'uWebSockets.js';
import Limits from './limits';

const CHECK_INTERVAL = 4000; // for ping

export default class TibiaWebSocket {
    checkInterval = null;

    start = (app: TemplatedApp) => {
        app.ws('/*', {
            compression: 0,
            maxPayloadLength: 16 * 1024,
            idleTimeout: 10,
            open: this.onOpen,
            close: this.onClose,
            message: this.onMessage
        });

        this.checkInterval = setInterval(this.check, CHECK_INTERVAL);
    }

    stop = () => {
        clearInterval(this.checkInterval)
    }

    private check = () => {

    }

    private onOpen = (ws: WebSocket, req) => {
        if (!Limits.acceptConnection(Buffer.from(ws.getRemoteAddress()))) {
            return ws.close();
        }
        
    }

    private onClose = (ws, code, message) => {

    }

    private onMessage = (ws, message, isBinary) => {
        console.log(message);
    }
}