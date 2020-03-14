import * as net from 'net';

import Config from './config';
import Crypto from './crypto';
import { InputPacket, OutputPacket } from './packet';

const TIMEOUT = 15000;
const MAX_PACKET_SIZE = 1024;

interface ConnectionData {
    size: number;
    pos: number;
    packet?: Buffer;
}

export default class TibiaTCP {
    private server: net.Server = null;
    private connections: Map<net.Socket, ConnectionData> = new Map();
    private crypto: Crypto;

    constructor(crypto: Crypto) {
        this.crypto = crypto;
    }

    public start = () => {
        if (this.server) {
            throw "TCP login server is already running";
        }
        this.server = net.createServer(this.onConnection);
        this.server.on("error", this.onError)
        this.server.on("close", this.onClose);
        this.server.listen(Config.port, Config.ip);
    }

    public stop = () => {
        if (!this.server)
            return;

        this.server.close();

        this.connections.forEach((data, socket) => {
            socket.destroy();
        });
    }

    private onClose = () => {
        this.server = null;
    }

    private onError = (error: Error) => {
        console.log("onError", error);
        //TODO: call listen again after some time
    }

    private onConnection = (socket: net.Socket) => {
        this.connections.set(socket, {
            size: 0,
            pos: 0,
            packet: null
        });

        // callbacks
        socket.on("close", this.onSocketClose.bind(this, socket));
        socket.on("data", this.onSocketData.bind(this, socket));

        socket.setTimeout(TIMEOUT, () => {
            socket.destroy();
        });
    } 

    private onSocketClose = (socket: net.Socket, had_error: boolean) => {
        this.connections.delete(socket);
    }

    private onSocketData = (socket: net.Socket, data: Buffer) => {
        const socketData = this.connections.get(socket);
        let dataPos = 0;
        while (dataPos < data.length) {
            if (socketData.packet === null) { // read header
                if (data.length < 2) {
                    socket.destroy();
                    return;
                }
                socketData.size = data.readInt16LE(0);
                if (socketData.size > MAX_PACKET_SIZE) {
                    socket.destroy();
                    return;
                }
                socketData.packet = Buffer.allocUnsafe(socketData.size);
                socketData.pos = 0;
                dataPos += 2; // header size
            }

            let copiedBytes = data.copy(socketData.packet, socketData.pos, dataPos, Math.min(data.length, dataPos + socketData.size - socketData.pos));
            dataPos += copiedBytes;
            socketData.pos += copiedBytes;
            if (socketData.pos = socketData.size) {
                try {
                    if (!this.onSocketPacket(socket, new InputPacket(socketData.packet))) {
                        socket.end();
                        break;
                    }
                } catch (e) { // invalid packet
                    console.log(e);
                    socket.destroy();
                    break;
                }
                socketData.packet = null;
            }
        }
    }

    // return true = keep connection and wait for next packet, return false = close connection, throw = destroy connection
    private onSocketPacket = (socket: net.Socket, packet: InputPacket): boolean => {
        const checksum = packet.getU32();
        const packet_type = packet.getU8();
        const os = packet.getU16();
        const version = packet.getU16();
        const client_version = packet.getU32();
        const data_signature = packet.getU32();
        const spr_signature = packet.getU32();
        const pic_signature = packet.getU32();
        const preview_state = packet.getU8();
        // rsa
        //crypto.privateDecrypt()
        let decryptedPacket = new InputPacket(this.crypto.rsaDecrypt(packet.getBytes(128)));
        let rsa_zero = decryptedPacket.getU8();
        if (rsa_zero != 0) {
            throw "RSA decryption error";
        }

        let xtea = [decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32()];
        let account = decryptedPacket.getString();
        let password = decryptedPacket.getString();


        this.sendLoginError(version, socket, `First workign version!\nHello: ${account}`, xtea);
        return false;
    }

    private sendLoginError(version: number, socket: net.Socket, message: string, xtea?: number[]) {
        let outputPacket = new OutputPacket();
        outputPacket.addU8(version >= 1076 ? 0x0B : 0x0A);
        outputPacket.addString(message);
        this.send(version, socket, outputPacket, xtea);
    }

    private send(version: number, socket: net.Socket, packet: OutputPacket, xtea?: number[]) {
        packet.xteaEncrypt(xtea);
        packet.addChecksum();
        packet.addSize();

        socket.write(packet.getSendBuffer());
    }
}
