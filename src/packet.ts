var XTEA = require('xtea');

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

    getU16 = () => {
        this.check(2);
        const ret = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        return ret;
    }

    getU32 = () => {
        this.check(4);
        const ret = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        return ret;
    }

    getString = () => {
        let size = this.getU16();
        this.check(size);
        const ret = this.buffer.toString('ascii', this.pos, this.pos + size);
        this.pos += size;
        return ret;
    }

    getBytes = (size: number) => {
        this.check(size);
        const ret = this.buffer.slice(this.pos, this.pos + size);
        this.pos += size;
        return ret;
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
        let u32 = new Uint32Array(this.buffer.buffer, this.buffer.byteOffset, this.pos / Uint32Array.BYTES_PER_ELEMENT);
        for (let i = 2; i < u32.length; i += 2) {
            u32[0] = 0; // sum
            for (let j = 0; j < 32; ++j) {
                u32[i] += (((u32[i + 1] << 4) >>> 0 ^ (u32[i + 1] >>> 5)) + u32[i + 1]) ^ (u32[0] + xtea[u32[0] & 3]);
                u32[0] = (u32[0] + 0x9E3779B9) >>> 0;
                u32[i + 1] += (((u32[i] << 4) >>> 0 ^ (u32[i] >>> 5)) + u32[i]) ^ (u32[0] + xtea[(u32[0] >> 11) & 3]);
            }
        }
    }

    addChecksum = () => {
        const m = 65521;
        let d = new Uint32Array(2);
        d[0] = 1;
        d[1] = 0;
        let size = this.pos - this.header;
        let p = this.header;
        while (size > 0) {
            let tlen = size > 5552 ? 5552 : size;
            size -= tlen;
            while (tlen--) {
                d[0] = d[0] + this.buffer[p++];
                d[1] = d[1] + d[0];
            }
            d[0] = d[0] % 65521;
            d[1] = d[1] % 65521;
        }

        d[1] = (d[1] << 16) | d[0];
        this.buffer.writeUInt32LE(d[1], this.header - 4);
        this.header -= 4;
    }

    addSize = () => {
        this.buffer.writeUInt16LE(this.pos - this.header, this.header - 2);
        this.header -= 2;
    }
}