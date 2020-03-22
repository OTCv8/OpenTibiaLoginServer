import Config from './config';
import { ip2int } from './utils';

interface Limit {
    t: Array<number>, // time
    c: Array<number>  // count
}

class Limits {
    private connectionLimits = new Map<number, Limit>();
    private authLimits = new Map<number, Limit>();

    convertAddress = (address: number | string | Buffer): number => {
        if (typeof (address) == 'number') {
            return address;
        } if (typeof (address) == 'string') {
            return ip2int(address);
        } else if (typeof (address) == 'object') {
            return address.readInt32BE(0);
        }
        console.error(`Invalid IP address: ${address}`);
    }

    acceptConnection = (address: number | string | Buffer): boolean => {
        let addr = this.convertAddress(address);
        if (!addr) return false;
        this.check();

        if (!this.connectionLimits.has(addr)) {
            this.connectionLimits.set(addr, {
                t: new Array<number>(Config.limits.connections.interval.length).fill(0),
                c: new Array<number>(Config.limits.connections.interval.length).fill(0),
            });
        }

        let limit = this.connectionLimits.get(addr);
        for (let i = 0; i < limit.c.length; ++i) {
            if (limit.t[i] + Config.limits.connections.interval[i] < Date.now() / 1000) {
                limit.t[i] = Date.now() / 1000;
                limit.c[i] = 0;
            }
            limit.c[i] += 1;
        }

        for (let i = 0; i < limit.c.length; ++i) {
            if (limit.c[i] >= Config.limits.connections.limit[i]) {
                return false;
            }
        }

        return true;
    }

    acceptAuthorization = (address: number | string | Buffer): boolean => {
        let addr = this.convertAddress(address);
        if (!addr) return false;

        let limit = this.authLimits.get(addr);
        if (!limit) {
            return true;
        }

        for (let i = 0; i < limit.c.length; ++i) {
            if (limit.t[i] + Config.limits.authorizations.interval[i] < Date.now() / 1000) {
                limit.t[i] = Date.now() / 1000;
                limit.c[i] = 0;
            }
        }

        for (let i = 0; i < limit.c.length; ++i) {
            if (limit.c[i] >= Config.limits.authorizations.limit[i]) {
                return false;
            }
        }

        return true;
    }

    addInvalidAuthorization = (address: number | string | Buffer) => {
        let addr = this.convertAddress(address);
        if (!addr) return false;
        this.check();

        if (!this.authLimits.has(addr)) {
            this.authLimits.set(addr, {
                t: new Array<number>(Config.limits.authorizations.interval.length).fill(0),
                c: new Array<number>(Config.limits.authorizations.interval.length).fill(0),
            });
        }

        let limit = this.authLimits.get(addr);
        for (let i = 0; i < limit.c.length; ++i) {
            if (limit.t[i] + Config.limits.authorizations.interval[i] < Date.now() / 1000) {
                limit.t[i] = Date.now() / 1000;
                limit.c[i] = 0;
            }
            limit.c[i] += 1;
        }

        return true;
    }

    private check = () => {
        // protects against high ram usage attack
        if (this.connectionLimits.size > 10000) {
            this.connectionLimits.clear();
        }
        if (this.authLimits.size > 10000) {
            this.authLimits.clear();
        }
    }

}

export default new Limits();
