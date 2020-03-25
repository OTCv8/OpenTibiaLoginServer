import * as mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';

import Config from './config';

export interface Account {
    id: number;
    name: string;
    password: string;
    type: number;
    premdays: number;
    email: string;
    secret: string;
    lastday: number,
    lastip: number
}

export interface Character {
    id: number,
    name: string,
    world_id: number,
    level: number,
    sex: number,
    vocation: number,
    lookbody: number,
    lookfeet: number,
    lookhead: number,
    looklegs: number,
    looktype: number,
    lookaddons: number
}

class DB {
    private conn: mysql.Pool = null;
    tables = {};
    // settings
    hasPlayersOnline = false;
    hasWorldIdInPlayersOnline = false;
    hasOnlineInPlayers = false;
    hasWorldIdInPlayers = false;
    hasServerConfig = false;
    hasLiveCasts = false;
    hasCams = false;

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
        // check connection
        await this.conn.query("SELECT 1");
        // try to auto detect what kind of database it is
        // first load details about this database
        let raw_tables_and_columns = await this.query("SELECT TABLE_NAME as `table`, COLUMN_NAME as `column` FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA LIKE ?", [Config.mysql.database]);
        raw_tables_and_columns.forEach((table_column) => {
            if (!this.tables[table_column.table]) {
                this.tables[table_column.table] = [];
            }
            this.tables[table_column.table].push(table_column.column);
        });

        // now set settings
        this.hasPlayersOnline = ('players_online' in this.tables);
        this.hasWorldIdInPlayersOnline = (this.hasPlayersOnline && this.tables['players_online'].includes('world_id'));
        this.hasOnlineInPlayers = (this.tables['players'].includes('online'));
        this.hasWorldIdInPlayers = (this.tables['players'].includes('world_id'));
        this.hasServerConfig = ("server_config" in this.tables);
        this.hasLiveCasts = ('live_casts' in this.tables);
        this.hasCams = ('cams' in this.tables);
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

    parseAccount = (account: RowDataPacket): Account => {
        return {
            id: account.id,
            name: account.name || account.id,
            password: account.password,
            type: account.type,
            premdays: account.premdays,
            email: account.email,
            secret: account.secret || "",
            lastday: account.lastday || 0,
            lastip: account.lastip || 0
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

    parseCharacter = (character: RowDataPacket): Character => {
        return {
            id: character.id,
            name: character.name,
            world_id: character.world_id || 0,
            level: character.level || 1,
            sex: character.sex || 0,
            vocation: character.vocation || 0,
            looktype: character.looktype || 128,
            lookbody: character.lookbody || 0,
            lookfeet: character.lookfeet || 0,
            lookhead: character.lookhead || 0,
            looklegs: character.looklegs || 0,
            lookaddons: character.lookaddons || 0
        }
    }

    getPlayersOnline = async (world_id?: number): Promise<number> => {
        // todo: add option for limit by ip
        // todo: dont count afk players
        if (this.hasPlayersOnline) {
            if (this.hasWorldIdInPlayersOnline && world_id) {
                return (await this.query('SELECT COUNT(*) as count FROM `players_online` WHERE `world_id` = ?', [world_id]))[0].count;
            }
            return (await this.query('SELECT COUNT(*) as count FROM `players_online`'))[0].count;
        } else if (this.hasOnlineInPlayers) {
            if (this.hasWorldIdInPlayers && world_id) {
                return (await this.query('SELECT COUNT(*) as count FROM `players` WHERE `online` = 1 and `world_id` = ?', [world_id]))[0].count;
            }
            return (await this.query('SELECT COUNT(*) as count FROM `players` WHERE `online` = 1'))[0].count;
        }
        return 0;
    }

    getOnlineRecord = async (world_id?: number): Promise<number> => {
        if (this.hasServerConfig) {
            let result = await this.query("SELECT `value` FROM `server_config` WHERE `config` = 'players_record'");
            if (result.length == 1) {
                return result[0].value;
            }
        }
        return 0;
    }


}

export default new DB();