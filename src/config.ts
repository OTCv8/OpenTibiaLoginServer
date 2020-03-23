import * as fs from 'fs';
import * as path from 'path';

let Config;
let loadingError = "Can't find config.json";

function validateConfig() {
    // todo
}

function loadConfig(dir: string): boolean {
    try {
        Config = require(path.resolve(`${dir}/config.json`));
    } catch (e) {
        return false;
    }
    try {
        Config['worlds'] = new Map<number, any>();
        let worldsDir = path.resolve(`${dir}/worlds`);
        let files = fs.readdirSync(worldsDir);
        for (let i = 0; i < files.length; ++i) {
            let file = files[i];
            if (file.toLowerCase().indexOf(".json") < 1) continue;
            let world = require(path.resolve(`${worldsDir}/${file}`));
            if (typeof (world.id) !== 'number') {
                throw `Invalid world id: ${file} - ${world.id}`;
            }
            Config['worlds'].set(world.id, world);
        }
        validateConfig();
    } catch (e) {
        loadingError = e;
        return false;
    }
    return true;
}

if (!loadConfig(".")) {
    throw `Can't load config. ${loadingError}`;
}

export default Config;
