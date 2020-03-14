import Crypto from './crypto';

export class InputPacket {
    private buffer: Buffer;
    private pos: number;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.pos = 0;
    }

    private check(size: number) {
        if (this.pos + size > this.buffer.length) {
            throw `Packet overflow (size: ${this.buffer.length})`;
        }
    }

    getU8 = () => {
        this.check(1);
        const ret = this.buffer.readUInt8(this.pos);
        this.pos += 1;
        return ret;
    }

    peekU8 = () => {
        this.check(1);
        const ret = this.buffer.readUInt8(this.pos);
        return ret;
    }

    getU16 = () => {
        this.check(2);
        const ret = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        return ret;
    }

    peekU16 = () => {
        this.check(2);
        const ret = this.buffer.readUInt16LE(this.pos);
        return ret;
    }

    getU32 = () => {
        this.check(4);
        const ret = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        return ret;
    }

    peekU32 = () => {
        this.check(4);
        const ret = this.buffer.readUInt32LE(this.pos);
        return ret;
    }

    getString = (size?: number) => {
        if (!size) {
            size = this.getU16();
        }
        this.check(size);
        const ret = this.buffer.toString('ascii', this.pos, this.pos + size);
        this.pos += size;
        return ret;
    }

    peekString = (size?: number) => {
        if (!size) {
            size = this.peekU16();
        }
        this.check(size);
        const ret = this.buffer.toString('ascii', this.pos + 2, this.pos + 2 + size);
        return ret;
    }

    getBytes = (size: number) => {
        this.check(size);
        const ret = this.buffer.slice(this.pos, this.pos + size);
        this.pos += size;
        return ret;
    }

    rsaDecrypt = () => {
        return new InputPacket(Crypto.rsaDecrypt(this.getBytes(128)));
    }

    adler32 = (): number => {
        return Crypto.adler32(this.buffer, this.pos + 4, this.buffer.length - this.pos - 4);
    }
}

export class OutputPacket {
    private buffer: Buffer;
    private pos: number;
    private header: number;

    constructor() {
        this.buffer = Buffer.allocUnsafe(8192);
        this.header = 10;
        this.pos = this.header;
    }

    private check(size: number) {
        if (this.pos + size > this.buffer.length) {
            throw `Packet overflow (size: ${this.buffer.length})`;
        }
    }

    length = () => {
        return this.pos;
    }

    getSendBuffer = () => {
        return Buffer.from(this.buffer.buffer, this.header, this.pos - this.header);
    }

    addU8 = (value: number) => {
        this.buffer.writeUInt8(value, this.pos);
        this.pos += 1;
    }

    addU16 = (value: number) => {
        this.buffer.writeUInt16LE(value, this.pos);
        this.pos += 2;
    }

    addU32 = (value: number) => {
        this.buffer.writeUInt32LE(value, this.pos);
        this.pos += 4;
    }

    addString = (value: string) => {
        this.addU16(value.length);
        this.buffer.write(value, this.pos);
        this.pos += value.length;
    }

    addBytes = (value: Buffer) => {
        this.addU16(value.length);
        value.copy(this.buffer, this.pos);
        this.pos += value.length;
    }

    xteaEncrypt = (xtea: number[]) => {
        if (this.header != 10) {
            throw `Invalid header size: ${this.header}`
        }

        // add size
        this.buffer.writeUInt16LE(this.pos - this.header, this.header - 2);
        this.header -= 2;
        if ((this.pos - this.header) % 8 != 0) {
            const toAdd = 8 - (this.pos - this.header) % 8;
            for (let i = 0; i < toAdd; ++i) {
                this.addU8(0x33);
            }
        }

        // xtea encrypt
        Crypto.xteaEncrypt(this.buffer, this.pos, xtea);
    }

    addChecksum = () => {
        this.buffer.writeUInt32LE(Crypto.adler32(this.buffer, this.header, this.pos - this.header), this.header - 4);
        this.header -= 4;
    }

    addSize = () => {
        this.buffer.writeUInt16LE(this.pos - this.header, this.header - 2);
        this.header -= 2;
    }
}