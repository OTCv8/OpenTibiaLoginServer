import { InputPacket, OutputPacket } from './packet';
import { Builder } from 'xml2js';

class Status {
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
            return await this.get();
        }
    }

    get = async () => {
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
                        "uptime": "1000",
                        "ip": "127.0.0.1",
                        "servername": "OTClient.ovh",
                        "port": "7171",
                        "location": "Europe",
                        "url": "http://otclient.ovh",
                        "server": "OTLS",
                        "version": "0.1.0",
                        "client": "10.99"
                    }
                },
                "owner": {
                    $: {
                        "name": "otclient",
                        "email": "otclient@otclient.ovh"
                    }
                },
                "players": {
                    $: {
                        "online": "1",
                        "max": "1",
                        "peak": "1"
                    }
                },
                "monsters": {
                    $: {
                        "total": "10"
                    }
                },
                "npcs": {
                    $: {
                        "total": "10"
                    }
                },
                "rates": {
                    $: {
                        "experience": "10",
                        "skill": "2",
                        "loot": "2",
                        "magic": "2",
                        "spawn": "3"
                    }
                },
                "map": {
                    $: {
                        "name": "otc",
                        "author": "noname",
                        "width": "1000",
                        "height": "1000"
                    }
                },
                "motd": "example motd"
            }
        };
        return this.builder.buildObject(status);
    }
}

export default new Status();
