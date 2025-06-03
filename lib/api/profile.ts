import Commands from '../commands.js';

export default class ProfileCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async connection(opts: {
        syncSecago: number,
        clientUid: string
    }): Promise<Buffer> {
        const url = new URL(`/Marti/api/device/profile/connection`, this.api.url);

        url.searchParams.append('syncSecago', String(opts.syncSecago));
        url.searchParams.append('clientUid', opts.clientUid);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
