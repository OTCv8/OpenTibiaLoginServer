import * as fs from 'fs';
import * as path from 'path';

let Config;
let loadingError = "Can't find config.json";

function validateConfig() {
    if (Config.tcp.enabled) {
        let used_ports = {}
        Config.worlds.forEach(world => {
            if (typeof (world.status_port) == 'number' && world.status_port > 0) {
                if (used_ports[world.status_port]) {
                    throw `Duplicated status port.\nStatus port for world ${world.name} is the same as status port for world ${used_ports[world.status_port]}.`
                }
                if (!Config.tcp.ports.includes(world.status_port)) {
                    throw `Invalid status port for world: ${world.name}.\nThis status port ${world.status_port} is not present on tcp port list ${Config.tcp.ports}`;
                }
            }
            used_ports[world.status_port] = world.name;
        });
    }
}

function loadConfig(dir: string): boolean {
    try {
        let file = path.resolve(`${dir}/config.json`)
        if (!fs.existsSync(file))
            return false;
        Config = require(file);
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
