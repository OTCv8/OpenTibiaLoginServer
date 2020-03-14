import Config from './config';
import Crypto from './crypto';
import DB from './db';
import TibiaTCP from './tcp';

let tcp = new TibiaTCP();
let working = true;

console.log("Starting Open Tibia Login Server...");
Crypto.init();

DB.start().then(() => {
    console.log("Connected to mysql database");
    tcp.start();
    console.log("Running");
}).catch((e) => {
    working = false;
    console.log("Error: can't connect to mysql host");
    console.log(e);
    process.exit(-1);
});

let quit = () => {
    if (!working) return;
    working = false;
    console.log("Exiting...");
    tcp.stop();
    DB.stop();
}

process.on('SIGINT', quit);
process.on('SIGQUIT', quit);
