import Config from './config';
import Crypto from './crypto';
import TibiaTCP from './tcp';

let crypto = new Crypto(Config.keyFile);
let tcp = new TibiaTCP(crypto);
tcp.start();

let quit = () => {
    console.log("Exiting...");
    tcp.stop();
}

process.on('SIGINT', quit);
process.on('SIGQUIT', quit);
