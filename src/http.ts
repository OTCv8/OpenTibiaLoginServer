import { TemplatedApp, WebSocket, HttpRequest, HttpResponse } from 'uWebSockets.js';
import Cams from './cams';
import Casts from './casts';
import Config from './config';
import Crypto from './crypto';
import DB from './db';
import Limits from './limits';
import Status from './status';
import { getVocationName } from './vocations';

export default class TibiaHTTP {

    start = (app: TemplatedApp) => {
        app.options("/api", (res, req) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.writeHeaders(res);
            res.end();
        }).any("/api", (res: HttpResponse, req: HttpRequest) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.writeHeaders(res);
            this.apiUrl(res, req);
        }).options("/status", (res, req) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.writeHeaders(res);
            res.end();
        }).any("/status", (res: HttpResponse, req: HttpRequest) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.writeHeaders(res);
            this.statusUrl(res, req);
        }).any("/login", (res: HttpResponse, req: HttpRequest) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.loginUrl(res, req);
        }).any("/*", (res: HttpResponse, req: HttpRequest) => {
            if (!Limits.acceptConnection(Buffer.from(res.getRemoteAddress()))) {
                return res.close();
            }
            this.wrongUrl(res, req);
        })
    }

    stop = () => {

    }

    private writeHeaders = (res: HttpResponse) => {
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.writeHeader('Access-Control-Allow-Headers', 'x-requested-with, Content-Type, origin, authorization, accept, client-security-token');
        res.writeHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
    }

    private wrongUrl = (res: HttpResponse, req: HttpRequest) => {
        return res.end("Open Tibia Login Server - Invalid url");
    }

    private loginUrl = (res: HttpResponse, req: HttpRequest) => {
        let buffer = "";
        res.onData((chunk, isLast) => {
            try {
                buffer += String.fromCharCode.apply(null, new Uint8Array(chunk));
                if (buffer.length > 1024) {
                    throw "too big buffer";
                    return;
                }
                if (!isLast) {
                    return;
                }

                if (buffer.length < 2) {
                    throw "Empty data";
                }

                let data = JSON.parse(buffer);
                if (data.type == "login") {
                    return this.login(res, data);
                } else if (data.type == "cacheinfo") {
                    return this.cacheInfo(res, data);
                } else if (data.type == "eventschedule") {
                    return this.eventSchedule(res, data);
                } else if (data.type == "boostedcreature") {
                    return this.boostedCreature(res, data);
                } else if (data.type == "news") {
                    return this.news(res, data);
                }
                throw `Invalid action type: ${data.type}`;
            } catch (e) {
                return res.end(e.toString());
            }
        });

        res.onAborted(() => { });
    }

    private apiUrl = (res: HttpResponse, req: HttpRequest) => {
        res.end("API");
    }

    private statusUrl = async (res: HttpResponse, req: HttpRequest) => {
        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });
        let status = await Status.getCached(0);
        if (!aborted) {
            res.end(status);
        }
    }

    private cacheInfo = async (res: HttpResponse, data: any) => {
        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });

        let response = {
            "twitchstreams": 0,
            "playersonline": await Status.getTotalOnlineCached(),
            "gamingyoutubestreams": 0,
            "twitchviewer": 0,
            "gamingyoutubeviewer": 0
        };
        if (!aborted) {
            res.end(JSON.stringify(response));
        }
    }

    private eventSchedule = (res: HttpResponse, data: any) => {
        let response = {
            "eventlist": [
                {
                    "description": "The moon is full! Beware, lycanthropic creatures like werewolves, werefoxes or werebears roam the lands now. And they are more aggressive and numerous than usual.",
                    "startdate": Math.floor(Date.now() / 1000 + 100), "colordark": "#735D10", "name": "Full Moon", "enddate": Math.floor(Date.now() / 1000 + 88100), "isseasonal": false, "colorlight": "#8B6D05"
                },
                {
                    "description": "Winterberries can now be found all over Tibia! The Combined Magical Winterberry Society wants YOU to help gathering them to create the juice that keeps the magic in the world flowing - good treading!",
                    "startdate": Math.floor(Date.now() / 1000 + 200), "colordark": "#7A4C1F", "name": "Annual Autumn Vintage", "enddate": Math.floor(Date.now() / 1000 + 88100), "isseasonal": false, "colorlight": "#935416"
                },
                {
                    "description": "This is the time of witches, ghosts and vampires. Look out for the Mutated Pumpkin and the Halloween Hare to make your flesh crawl.",
                    "startdate": Math.floor(Date.now() / 1000 + 300), "colordark": "#235c00", "name": "Halloween Event", "enddate": Math.floor(Date.now() / 1000 + 88100), "isseasonal": false, "colorlight": "#2d7400"
                }
            ]
        };
        res.end(JSON.stringify(response));
    }

    private boostedCreature = (res: HttpResponse, data: any) => {
        let response = {
            "raceid": 219
        };
        res.end(JSON.stringify(response));
    }

    private news = (res: HttpResponse, data: any) => {
        // data has: "count":0,"isreturner":false,"offset":0,"showrewardnews":false
        let response = {
            "gamenews": [],
            "categorycounts": {
                "support": 4,
                "game contents": 11,
                "useful info": 3,
                "major updates": 13,
                "client features": 8
            },
            "maxeditdate": 1544000339
        };
        res.end(JSON.stringify(response));
    }

    private login = async (res: HttpResponse, data: any) => {
        let aborted = false;
        res.onAborted(() => {
            aborted = true;
        });
        let ip_address = Buffer.from(res.getRemoteAddress());
        let account_name = data.accountname;
        let account_password = data.password;
        let account_token = data.token || "";
        let stayloggedin = data.stayloggedin;

        // codes: 3 - invalid acc/pass, 6 - token is required
        let loginError = (message: string, code: number = 3) => {
            if (aborted) return;
            return res.end(JSON.stringify({
                "errorCode": code,
                "errorMessage": message
            }));
        };

        if (!Limits.acceptAuthorization(ip_address)) {
            return loginError("Too many invalid login attempts.\nYou has been blocked for few minutes.");
        }

        let cams = await Cams.get(account_name, account_password);
        if (cams !== null) {
            return loginError("Cams are not done yet");
        }

        let casts = await Casts.get(account_name, account_password);
        if (casts !== null) {
            return loginError("Casts are not done yet");
        }

        let account = await DB.loadAccountByName(account_name);
        let hashed_password = Crypto.hashPassword(account_password);
        if (!account || account.password != hashed_password) {
            Limits.addInvalidAuthorization(ip_address);
            return loginError("Invalid account/password");
        }

        if (account.secret.length > 0) {
            if (account_token.length == 0) {
                return loginError("Two-factor token required for authentication.", 6);
            }
            if (!Crypto.validateToken(account_token, account.secret)) {
                Limits.addInvalidAuthorization(ip_address);
                return loginError("Invalid two-factor token.", 6);
            }
        }

        let characters = await DB.loadCharactersByAccountId(account.id);

        let response = {
            "session": {
                "returnernotification": false,
                "fpstracking": false,
                "optiontracking": false,
                "isreturner": false,
                "status": "active",
                "sessionkey": "",
                "ispremium": false,
                "showrewardnews": false,
                "lastlogintime": 0,
                "premiumuntil": 0
            },
            "playdata": {
                "worlds": [],
                "characters": []
            }
        };
        
        response['session']['sessionkey'] = `${account_name}\n${account_password}\n${account_token}\n${Math.floor(Date.now() / 30000)})`;

        Config.worlds.forEach((world) => {
            response['playdata']['worlds'].push({
                "id": world.id,
                "name": world.name,
                "externaladdressprotected": world.host,
                "externaladdressunprotected": world.host,
                "externalportprotected": world.port,
                "externalportunprotected": world.port,
                "pvptype": world.pvptype,
                "location": world.location,
                "previewstate": world.preview ? 1 : 0,
                "anticheatprotection": false,
            });
        });

        characters.forEach((character) => {
            response['playdata']['characters'].push({
                "name": character.name,
                "worldid": character.world_id,
                "level": character.level,
                "ishidden": false,
                "headcolor": character.lookhead,
                "legscolor": character.looklegs,
                "torsocolor": character.lookbody,
                "detailcolor": character.lookfeet,
                "outfitid": character.looktype,
                "addonsflags": character.lookaddons,
                "vocation": getVocationName(character.vocation),
                "tutorial": false,
                "ismale": character.sex == 1
            });
        });

        if (!aborted) {
            return res.end(JSON.stringify(response));
        }
    }

}