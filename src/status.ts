import { InputPacket, OutputPacket } from './packet';
import { Builder } from 'xml2js';

import Config from './config';
import DB from './db';
import { getMotd } from './motd';

let UPDATE_INTERVAL = 5000;

class Status {
    start = Date.now();
    peak = {};
    cache = {};

    builder = new Builder({
        rootName: "xml",
        renderOpts: {
            'pretty': false
        },
        xmldec: {
            'version': '1.0'
        }
    });

    process = async (host: string, port: number, packet: InputPacket): Promise<string> => {
        let type = packet.getU8();
        if (type == 0xFF) { // general info
            let worldId;
            Config.worlds.forEach((world) => {
                if (world.status_port == port) {
                    worldId = world.id;
                }
            });
            if (worldId !== null) {
                return await this.getCached(worldId);
            }
            return "WORLD_NOT_FOUND";
        }
        return "INVALID_REQUEST";
    }

    getCached = async (world_id: number) => {
        if (!this.cache[world_id] || this.cache[world_id].lastUpdate + UPDATE_INTERVAL < Date.now()) {
            this.cache[world_id] = {
                content: await this.get(world_id),
                lastUpdate: Date.now()
            };
        }

        return this.cache[world_id].content;
    }

    private get = async (world_id: number) => {
        let world = Config.worlds.get(world_id);
        if (!world) {
            return "INVALID_WORLD_ID";
        }

        let playersOnline = await DB.getPlayersOnline();
        // todo: get real online peak
        if (!this.peak[world_id] || this.peak[world_id] <= playersOnline) {
            this.peak[world_id] = playersOnline + 1;
        }

        let status = {
            $: {
                "version": "1.0",
            },
            "tsqp": {
                $: {
                    "version": "1.0",
                },
                "serverinfo": {
                    $: {
                        "uptime": Math.floor((Date.now() - this.start) / 1000),
                        "ip": world.host,
                        "port": world.port,
                        "servername": world.name,
                        "location": world.location,
                        "url": world.url,
                        "server": "Open Tibia Login Server",
                        "version": "1.0",
                        "client": world.client
                    }
                },
                "owner": {
                    $: {
                        "name": world.owner.name,
                        "email": world.owner.email
                    }
                },
                "players": {
                    $: {
                        "online": playersOnline,
                        "max": world.maxplayers,
                        "peak": this.peak[world_id]
                    }
                },
                "monsters": {
                    $: {
                        "total": world.monsters
                    }
                },
                "npcs": {
                    $: {
                        "total": world.npcs
                    }
                },
                "rates": {
                    $: world.rates
                },
                "map": {
                    $: world.map
                },
                "motd": getMotd()
            }
        };
        return this.builder.buildObject(status);
    }
}

export default new Status();
