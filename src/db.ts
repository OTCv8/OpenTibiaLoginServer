import * as mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';
import { Mutex, MutexInterface } from 'async-mutex';

import Config from './config';

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
    world_id: number,
    level: number,
    sex: number
}

class DB {
    private conn: mysql.Pool = null;
    private mutex = new Mutex();

    start = async () => {
        if (this.conn) {
            throw "DB has already started";
        }
        this.conn = await mysql.createPool({
            host: Config.mysql.host,
            user: Config.mysql.user,
            password: Config.mysql.password,
            database: Config.mysql.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 10000
        });
        await this.conn.query("SELECT 1"); // check connection
    }

    stop = async () => {
        await this.conn.end();
    }

    query = async (query: string, params?: any[]): Promise<RowDataPacket[]> => {
        let [result, fields] = await this.conn.execute<RowDataPacket[]>(query, params);
        return result;
    }

    loadAccountById = async (id: number): Promise<Account> => {
        const accounts = await this.query('SELECT * FROM `accounts` where `id` = ?', [id]);
        if (accounts.length != 1) {
            return null;
        }
        return this.parseAccount(accounts[0])
    }

    loadAccountByName = async (name: string): Promise<Account> => {
        const accounts = await this.query('SELECT * FROM `accounts` where `name` = ?', [name]);
        if (accounts.length != 1) {
            return null;
        }
        return this.parseAccount(accounts[0])
    }

    private parseAccount = (account: RowDataPacket): Account => {
        return {
            id: account.id,
            name: account.name || account.id,
            password: account.password,
            type: account.type,
            premdays: account.premdays,
            email: account.email
        };
    }

    loadCharactersByAccountId = async (accountId: number|string): Promise<Character[]> => {
        let characters = await this.query('SELECT * FROM `players` where `account_id` = ?', [accountId]);
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
            level: character.level,
            sex: character.sex
        }
    }


}

export default new DB();