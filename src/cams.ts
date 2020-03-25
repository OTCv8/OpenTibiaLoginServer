import Config from './config';
import DB, { Character } from './db';

class Cams {
    get = async (name: string, password: string): Promise<Character[]> => {
        if (Config.cams !== true) {
            return null;
        }
        if (name.toLocaleLowerCase().indexOf("!cam") == 0) {
            return [];
        }
        return null;
    }
}

export default new Cams;