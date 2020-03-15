import { TemplatedApp, WebSocket, HttpResponse } from 'uWebSockets.js';

export default class TibiaHTTP {

    start = (app: TemplatedApp) => {
        app.options("/*", (res, req) => {
            this.writeHeaders(res);
            res.end();
        }).any("/*", (res, req) => {
            this.writeHeaders(res);
            res.end("Open Tibia Login Server");
        })
    }

    stop = () => {

    }

    private writeHeaders = (res: HttpResponse) => {
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.writeHeader('Access-Control-Allow-Headers', 'x-requested-with, Content-Type, origin, authorization, accept, client-security-token');
        res.writeHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
    }

}