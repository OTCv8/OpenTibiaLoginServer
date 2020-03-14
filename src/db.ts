import * as mysql from 'mysql2/promise';
import Config from './config';
import { RowDataPacket } from 'mysql2/promise';

interface Account {
    id: number;
    name: string;
    password: string;
    type: number;
    premdays: number;
    email: string;
}

interface Character {
    id: number,
    name: string,
    world_id: number
}

class DB {
    private conn: mysql.Connection = null;

    start = async () => {
        if (this.conn) {
            throw "DB has already started";
        }

        this.conn = await mysql.createConnection({
            host: Config.mysql.host,
            user: Config.mysql.user,
            password: Config.mysql.password,
            database: Config.mysql.database
        });
    }

    stop = async () => {
        await this.conn.end();
    }

    loadAccountById = async (id: string): Promise<Account> => {
        const [accounts, fields] = await this.conn.execute<RowDataPacket[]>('SELECT * FROM `accounts` where `id` = ?', [id]);
        if (accounts.length != 1) {
            return null;
        }
        return this.parseAccount(accounts[0])
    }

    loadAccountByName = async (name: string): Promise<Account> => {
        const [accounts, fields] = await this.conn.execute<RowDataPacket[]>('SELECT * FROM `accounts` where `name` = ?', [name]);
        if (accounts.length != 1) {
            return null;
        }
        return this.parseAccount(accounts[0])
    }

    private parseAccount = (account: RowDataPacket): Account => {
        return {
            id: account.id,
            name: account.name,
            password: account.password,
            type: account.type,
            premdays: account.premdays,
            email: account.email
        };
    }

    loadCharactersByAccountId = async (accountId: number|string): Promise<Character[]> => {
        const [characters, fields] = await this.conn.execute<RowDataPacket[]>('SELECT * FROM `players` where `account_id` = ?', [accountId]);
        let ret: Character[] = [];
        for (let i = 0; i < characters.length; ++i) {
            ret.push(this.parseCharacter(characters[i]));
        }
        return ret;
    }

    private parseCharacter = (character: RowDataPacket): Character => {
        return {
            id: character.id,
            name: character.name,
            world_id: character.world_id || 0,
        }
    }


}

export default new DB();