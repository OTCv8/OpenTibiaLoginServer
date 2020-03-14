import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from 'constants';

export default class Crypto {
    privateKey: string;

    constructor(keyFile: string) {
        try {
            const keyFilePath = path.resolve(keyFile);
            this.privateKey = fs.readFileSync(keyFilePath, 'utf-8').toString().trim();
            crypto.publicEncrypt(this.privateKey, Buffer.from("Test"));
        } catch (e) {
            throw `Can't load private key = ${keyFile}`
        }
    }

    rsaDecrypt = (buffer: Buffer) : Buffer => {
        if (buffer.length != 128) {
            throw `rsaDecrypt: Invalid buffer length: ${buffer.length}`
        }
        return crypto.privateDecrypt({
                key: this.privateKey,
                padding: constants.RSA_NO_PADDING,
                passphrase: ''
            }, buffer);
    }

}