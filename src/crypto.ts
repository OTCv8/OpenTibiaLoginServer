import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from 'constants';
import { authenticator } from 'otplib';

import Config from './config';

authenticator.options = {
    window: 2
};

class Crypto {
    privateKey: string = null;

    init = () => {
        if (this.privateKey) {
            throw "Crypto is already initialized";
        }
        try {
            const keyFilePath = path.resolve(Config.keyFile);
            this.privateKey = fs.readFileSync(keyFilePath, 'utf-8').toString().trim();
            crypto.publicEncrypt(this.privateKey, Buffer.from("Test"));
        } catch (e) {
            throw `Can't load private key from ${Config.keyFile}`
        }
    }

    rsaDecrypt = (buffer: Buffer): Buffer => {
        if (buffer.length != 128) {
            throw `rsaDecrypt: Invalid buffer length: ${buffer.length}`
        }
        return crypto.privateDecrypt({
            key: this.privateKey,
            padding: constants.RSA_NO_PADDING,
            passphrase: ''
        }, buffer);
    }

    xteaEncrypt = (buffer: Buffer, size: number, xtea: number[]) => {
        let u32 = new Uint32Array(buffer.buffer, buffer.byteOffset, size / Uint32Array.BYTES_PER_ELEMENT);
        for (let i = 2; i < u32.length; i += 2) {
            u32[0] = 0; // sum
            for (let j = 0; j < 32; ++j) {
                u32[i] += (((u32[i + 1] << 4) >>> 0 ^ (u32[i + 1] >>> 5)) + u32[i + 1]) ^ (u32[0] + xtea[u32[0] & 3]);
                u32[0] = (u32[0] + 0x9E3779B9) >>> 0;
                u32[i + 1] += (((u32[i] << 4) >>> 0 ^ (u32[i] >>> 5)) + u32[i]) ^ (u32[0] + xtea[(u32[0] >> 11) & 3]);
            }
        }
    }

    adler32 = (buffer: Buffer, offset: number, size: number) => {
        const m = 65521;
        let d = new Uint32Array(2);
        d[0] = 1;
        d[1] = 0;
        let p = offset;
        while (size > 0) {
            let tlen = size > 5552 ? 5552 : size;
            size -= tlen;
            while (tlen--) {
                d[0] = d[0] + buffer[p++];
                d[1] = d[1] + d[0];
            }
            d[0] = d[0] % 65521;
            d[1] = d[1] % 65521;
        }

        d[1] = (d[1] << 16) | d[0];
        return d[1];
    }

    hash = (algorithm: string, data: string): string => {
        return crypto.createHash(algorithm).update(data).digest("hex");
    }

    md5 = (data: string): string => {
        return this.hash("md5", data);
    }

    sha1 = (data: string): string => {
        return this.hash("sha1", data);
    }

    sha256 = (data: string): string => {
        return this.hash("sha256", data);
    }

    sha512 = (data: string): string => {
        return this.hash("sha512", data);
    }

    hashPassword = (password: string): string => {
        if (Config.encryption == "sha" || Config.encryption == "sha1") {
            return this.sha1(password);
        } else if (Config.encryption == "sha2" || Config.encryption == "sha256") {
            return this.sha256(password);
        } else if (Config.encryption == "sha512") {
            return this.sha512(password);
        } else if (Config.encryption == "md5") {
            return this.md5(password);
        }
        return password;
    }

    validateToken = (token: string, secret: string): boolean => {
        return authenticator .check(token, secret);
    }
}

export default new Crypto();
