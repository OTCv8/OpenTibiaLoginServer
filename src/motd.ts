import Config from './config';

export function getMotdId(account_id?: number): number {
    return Config.motd.id;
}

export function getMotd(account_id?: number): string {
    return Config.motd.text;
}
