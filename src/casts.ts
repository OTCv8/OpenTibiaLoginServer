import Config from './config';
import DB, { Character } from './db';

class Casts {
    get = async (name: string, password: string): Promise<Character[]> => {
        if (Config.casts !== true) {
            return null;
        }
        if (name.length == 0 || name.toLocaleLowerCase().indexOf("!cast") == 0) {
            return [];
        }
        return null;
    }
}

export default new Casts;