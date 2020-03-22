import { App, SSLApp, TemplatedApp, us_listen_socket, us_listen_socket_close } from 'uWebSockets.js';

import Config from './config';

import TibiaHTTP from './http';
import TibiaTCP from './tcp';
import TibiaWebSocket from './websocket';

export default class Server {
    app: TemplatedApp;
    tcp: TibiaTCP;
    http: TibiaHTTP;
    ws: TibiaWebSocket;
    socket: us_listen_socket;
        
    start = async () => {
        if (Config.tcp.enabled && !this.tcp) {
            this.tcp = new TibiaTCP();
            this.tcp.start(Config.tcp.host, Config.tcp.port);
        }

        if (Config.http.enabled && !this.app) {
            this.app = App({});
            this.http = new TibiaHTTP();
            this.ws = new TibiaWebSocket();

            this.http.start(this.app);
            this.ws.start(this.app);

            return await new Promise((resolve) => {
                this.app.listen(Config.http.host, Config.http.port, (listenSocket) => {
                    if (listenSocket) {
                        this.socket = listenSocket;
                        resolve();
                    }
                });
            });
        }
    }

    stop = () => {
        if (this.tcp) {
            this.tcp.stop();
            this.tcp = null;
        }
        if (this.app) {
            this.http.stop();
            this.ws.stop();
            if (this.socket) {
                us_listen_socket_close(this.socket);
                this.socket = null;
            }
            this.http = null;
            this.ws = null;
            this.app = null;
        }
    }

}