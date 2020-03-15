import Config from './config';
import Crypto from './crypto';
import DB from './db';
import Server from './server';

let working = false;
let server = new Server();

console.log("Starting Open Tibia Login Server...");
Crypto.init();

DB.start().then(() => {
    console.log("Connected to mysql database");
    server.start().then(() => {
        console.log("Running");
        working = true;
    }).catch((e) => {
        DB.stop();
        console.log("Error: can't start server");
        console.log(e);
        process.exit(-1);
    });
}).catch((e) => {
    console.log("Error: can't connect to mysql host");
    console.log(e);
    process.exit(-1);
});

let quit = () => {
    if (!working) return;
    working = false;
    console.log("Exiting...");
    server.stop();
    DB.stop();
}

process.on('SIGINT', quit);
process.on('SIGQUIT', quit);
