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
        this.tcp = new TibiaTCP();
        this.app = App({});
        this.http = new TibiaHTTP();
        this.ws = new TibiaWebSocket();

        this.tcp.start();
        this.http.start(this.app);
        this.ws.start(this.app);

        return await new Promise((resolve) => {
            this.app.listen(Config.http.host, Config.http.port, (listenSocket) => {
                if (listenSocket) {
                    resolve();
                }
            });
        });
    }

    stop = () => {
        this.tcp.stop();
        this.http.stop();
        this.ws.stop();
        us_listen_socket_close(this.socket);
    }

}