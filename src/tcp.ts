import * as net from 'net';

import Config from './config';
import Crypto from './crypto';
import DB from './db';
import { InputPacket, OutputPacket } from './packet';
import Status from './status';

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

    private onSocketData = async (socket: net.Socket, data: Buffer) => {
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
                    if (await this.onSocketPacket(socket, new InputPacket(socketData.packet)) !== true) {
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
    private onSocketPacket = async (socket: net.Socket, packet: InputPacket): Promise<boolean> => {
        //console.log(packet.toHexString()); // may be used for benchmark

        const checksum = packet.peekU32();
        if (checksum == packet.adler32()) {
            packet.getU32(); // read checksum
        }

        const packet_type = packet.getU8();
        if (packet_type == 0xFF) { // status check
            let output = await Status.process(packet);
            if (output) {
                socket.write(output.getSendBuffer());
            }
            return false;
        }

        const os = packet.getU16();
        const version = packet.getU16();
        const client_version = packet.getU32();
        const data_signature = packet.getU32();
        const spr_signature = packet.getU32();
        const pic_signature = packet.getU32();
        const preview_state = packet.getU8();

        let decryptedPacket = packet.rsaDecrypt();
        if (decryptedPacket.getU8() != 0) {
            throw "RSA decryption error (1)";
        }

        let xtea = [decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32()];
        let account_name = decryptedPacket.getString();
        let account_password = decryptedPacket.getString();

        let oglInfo1 = packet.getU8();
        let oglInfo2 = packet.getU8();
        let gpu = packet.getString();
        let gpu_version = packet.getString();

        let decryptedAuthPacket = packet.rsaDecrypt();
        if (decryptedAuthPacket.getU8() != 0) {
            throw "RSA decryption error (2)";
        }
        let token = decryptedAuthPacket.getString();
        let stayLogged = decryptedAuthPacket.getU8();

        // function to make sending error easier
        const loginError = (error: string): boolean => {
            let outputPacket = new OutputPacket();
            outputPacket.addU8(version >= 1076 ? 0x0B : 0x0A);
            outputPacket.addString(error);
            this.send(version, socket, outputPacket, xtea);
            return false;
        }

        let account = await DB.loadAccountByName(account_name);
        if (!account) {
            return loginError("Invalid account/password");
        }

        let hashed_password = account_password;
        if (Config.encryption == "sha1") {
            hashed_password = Crypto.sha1(hashed_password);
        } else if (Config.encryption == "sha256") {
            hashed_password = Crypto.sha256(hashed_password);
        } else if (Config.encryption == "sha512") {
            hashed_password = Crypto.sha512(hashed_password);
        } else if (Config.encryption == "md5") {
            hashed_password = Crypto.md5(hashed_password);
        }

        if (account.password != hashed_password) {
            return loginError("Invalid account/password");
        }

        let characters = await DB.loadCharactersByAccountId(account.id);

        let outputPacket = new OutputPacket();

        // motd
        outputPacket.addU8(0x14);
        outputPacket.addString("1\rTest motd");

        // session key
        outputPacket.addU8(0x28);
        outputPacket.addString(`${account_name}\n${account_password}\n${token}\n0`);

        // worlds & characters & premium
        outputPacket.addU8(0x64);

        // worlds
        outputPacket.addU8(Object.keys(Config.worlds).length);
        for (let worldId in Config.worlds) {
            const world = Config.worlds[worldId];
            outputPacket.addU8(parseInt(worldId));
            outputPacket.addString(world.name);
            outputPacket.addString(world.host);
            outputPacket.addU16(world.port);
            outputPacket.addU8(0); // preview
        }

        // characters
        outputPacket.addU8(characters.length);
        characters.forEach(character => {
            outputPacket.addU8(character.world_id);
            outputPacket.addString(character.name);
        });
        
        // premium
        outputPacket.addU8(0); // premium status
        outputPacket.addU8(account.premdays > 0 ? 1 : 0); // premium substatus
        outputPacket.addU32(account.premdays);

        this.send(version, socket, outputPacket, xtea);
        return false; // close connection
    }

    private send(version: number, socket: net.Socket, packet: OutputPacket, xtea?: number[]) {
        packet.xteaEncrypt(xtea);
        packet.addChecksum();
        packet.addSize();

        if (socket) { // it's null when benchmarking
            socket.write(packet.getSendBuffer());
        }
    }

    public benchmark = async (packet: Buffer) => {
        try {
            return await this.onSocketPacket(null, new InputPacket(packet));
        } catch (e) { }
    }
}
