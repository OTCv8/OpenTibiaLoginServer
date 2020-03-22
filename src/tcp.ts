import * as net from 'net';

import Config from './config';
import Crypto from './crypto';
import DB from './db';
import Limits from './limits';
import { InputPacket, OutputPacket } from './packet';
import { getMotd } from './motd';
import Status from './status';
import { ip2int } from './utils';

const TIMEOUT = 15000;
const MAX_PACKET_SIZE = 1024;

interface ConnectionData {
    size: number;
    pos: number;
    packet?: Buffer;
}

export default class TibiaTCP {
    private server: net.Server = null;
    private host: string;
    private port: number;
    private connections: Map<net.Socket, ConnectionData> = new Map();

    public start = (host: string, port: number) => {
        if (this.server) {
            throw "TCP login server is already running";
        }
        this.host = host;
        this.port = port;
        this.bind(false);
    }

    public stop = () => {
        if (!this.server)
            return;

        this.server.close();

        this.connections.forEach((data, socket) => {
            socket.destroy();
        });
    }

    private bind = (rebind: boolean) => {
        if (rebind && !this.server)
            return;
        this.server = net.createServer(this.onConnection);
        this.server.on("error", this.onError)
        this.server.on("close", this.onClose);
        this.server.listen(this.port, this.host);
    }

    private onClose = () => {
        this.server = null;
    }

    private onError = (error: Error) => {
        console.log("TCP Server error: ", error);
        console.log("Rebinding in 1s");
        setTimeout(this.bind, 1000, true).unref();
    }

    private onConnection = (socket: net.Socket) => {
        if (!Limits.acceptConnection(socket.address().address)) {
            socket.destroy();
            return;
        }

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
                    await this.onSocketPacket(socket, new InputPacket(socketData.packet));
                    socket.end();
                    break; // end connection after first packet
                } catch (e) { // invalid packet
                    console.log(e);
                    socket.destroy();
                    break;
                }
                socketData.packet = null;
            }
        }
    }

    // throw = destroy connection
    private onSocketPacket = async (socket: net.Socket, packet: InputPacket) => {
        //console.log(packet.toHexString()); // may be used for benchmark

        let has_checksum = false;
        const checksum = packet.peekU32();
        if (checksum == packet.adler32()) {
            packet.getU32(); // read checksum
            has_checksum = true;
        }

        const packet_type = packet.getU8();
        if (packet_type == 0xFF) { // status check
            let output = await Status.process(this.host, this.port, packet);
            if (output) {
                socket.write(output.getSendBuffer());
            }
            return;
        }

        if (packet_type != 0x01) {
            throw `Invalid packet type: ${packet_type}, should be 1`;
        }

        const os = packet.getU16();
        const version = packet.getU16();
        if (version >= 980) {
            const client_version = packet.getU32();
        }
        if (version >= 1071) {
            const content_revision = packet.getU16();
            packet.getU16(); // unkown, otclient sends 0
        } else {
            const data_signature = packet.getU32();
        }
        const spr_signature = packet.getU32();
        const pic_signature = packet.getU32();
        if (version >= 980) {
            const preview_state = packet.getU8();
        }

        let decryptedPacket = packet;
        let xtea = null;
        if (version >= 770) { // encryption has been added in 770
            decryptedPacket = packet.rsaDecrypt();
            if (decryptedPacket.getU8() != 0) {
                throw "RSA decryption error (1)";
            }

            xtea = [decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32(), decryptedPacket.getU32()];
        }

        let account_name;
        if (version >= 840) {
            account_name = decryptedPacket.getString();;
        } else {
            account_name = decryptedPacket.getU32();
        }
        let account_password = decryptedPacket.getString();

        // otclient extended data, optional
        // decryptedPacket.getString();

        if (version >= 1061) { // gpu info, unused by now
            const oglInfo1 = packet.getU8();
            const oglInfo2 = packet.getU8();
            const gpu = packet.getString();
            const gpu_version = packet.getString();
        }

        let token;
        let stayLogged = true;
        if (version >= 1072) { // auth token, unused by now
            let decryptedAuthPacket = packet.rsaDecrypt();
            if (decryptedAuthPacket.getU8() != 0) {
                throw "RSA decryption error (2)";
            }
            token = decryptedAuthPacket.getString();
            if (version >= 1074) {
                stayLogged = decryptedAuthPacket.getU8() > 0;
            }            
        }

        // function to make sending error easier
        const loginError = (error: string) => {
            let outputPacket = new OutputPacket();
            outputPacket.addU8(version >= 1076 ? 0x0B : 0x0A);
            outputPacket.addString(error);
            this.send(socket, outputPacket, has_checksum, xtea);
        }

        if (Config.version.min > version || version > Config.version.max) {
            return loginError(`Invalid client version (should be: ${Config.version.min}-${Config.version.max}, is: ${version}).`);
        }

        if (!Limits.acceptAuthorization(socket.address().address)) {
            return loginError("Too many login attempts.\nYou has been blocked for few minutes.");
        }

        let account;
        if (typeof (account_name) == 'number') {
            account = await DB.loadAccountById(account_name); // by id, for <840
        } else {
            account = await DB.loadAccountByName(account_name); // by name, for >=840
        }

        if (!account) {
            Limits.addInvalidAuthorization(socket.address().address);
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
            Limits.addInvalidAuthorization(socket.address().address);
            return loginError("Invalid account/password");
        }

        let characters = await DB.loadCharactersByAccountId(account.id);

        let outputPacket = new OutputPacket();

        // motd
        let motd = getMotd(account.id);
        if (motd) {
            outputPacket.addU8(0x14);
            outputPacket.addString(motd);
        }

        // session key
        if (version >= 1074) {
            outputPacket.addU8(0x28);
            outputPacket.addString(`${account_name}\n${account_password}\n${token}\n${Math.floor(Date.now() / 1000)}`);
        }

        // worlds & characters & premium
        outputPacket.addU8(0x64);

        if (version >= 1010) {
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
        } else {
            outputPacket.addU8(characters.length);
            characters.forEach(character => {
                outputPacket.addString(character.name);
                let world = Config.worlds[character.world_id.toString()]; // keys are numbers
                if (!world) {
                    outputPacket.addString("INVALID WORLD")
                    outputPacket.addU32(0);
                    outputPacket.addU16(0);
                } else {
                    outputPacket.addString(world.name);
                    outputPacket.addU32(ip2int(world.host));
                    outputPacket.addU16(world.port);
                }
                if (version >= 980) {
                    outputPacket.addU8(0); // preview state
                }
            });
        }
        
        // premium
        if (version > 1077) {
            outputPacket.addU8(0); // account status: 0 - OK, 1 - Frozen, 2 - Suspended
            outputPacket.addU8(account.premdays > 0 ? 1 : 0); // premium status: 0 - Free, 1 - Premium
            outputPacket.addU32(account.premdays);
        } else {
            outputPacket.addU16(account.premdays);
        }

        this.send(socket, outputPacket, has_checksum, xtea);
    }

    private send(socket: net.Socket, packet: OutputPacket, has_checksum: boolean, xtea?: number[]) {
        if (xtea) {
            packet.xteaEncrypt(xtea);
        }
        if (has_checksum) {
            packet.addChecksum();
        }
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
