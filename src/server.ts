import { App, SSLApp, TemplatedApp, us_listen_socket, us_listen_socket_close } from 'uWebSockets.js';

import Config from './config';

import TibiaHTTP from './http';
import TibiaTCP from './tcp';
import TibiaWebSocket from './websocket';

export default class Server {
    app: TemplatedApp;
    tcps: TibiaTCP[] = [];
    http: TibiaHTTP;
    ws: TibiaWebSocket;
    sockets: us_listen_socket[] = [];

    start = async () => {
        if (Config.tcp.enabled) {
            Config.tcp.ports.forEach(port => {
                let tcp = new TibiaTCP();
                tcp.start(Config.tcp.host, port);
                this.tcps.push(tcp);
            })
        }

        if (Config.http.enabled) {
            if (Config.http.ssl.enabled) {
                try {
                    this.app = SSLApp({
                        cert_file_name: Config.http.ssl.cert,
                        key_file_name: Config.http.ssl.key,
                        passphrase: Config.http.ssl.passphrase
                    });
                } catch (e) {
                    throw `${e.toString()}\nMake sure if your SSL config for http server is correct`;
                }
            } else {
                this.app = App({});
            }
            this.http = new TibiaHTTP();
            this.ws = new TibiaWebSocket();

            this.http.start(this.app);
            this.ws.start(this.app);

            Config.http.ports.forEach(async (port) => {
                await new Promise((resolve) => {
                    this.app.listen(Config.http.host, port, (listenSocket) => {
                        if (listenSocket) {
                            this.sockets.push(listenSocket);
                            resolve();
                        }
                    });
                });
            });
        }
    }

    stop = () => {
        this.tcps.forEach(tcp => {
            tcp.stop();
        });
        this.tcps = [];

        this.sockets.forEach(socket => {
            us_listen_socket_close(socket);
        });
        this.sockets = [];

        if (this.app) {
            this.http.stop();
            this.ws.stop();
            this.http = null;
            this.ws = null;
            this.app = null;
        }
    }

}