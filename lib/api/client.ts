import { Type, Static } from '@sinclair/typebox';
import type { ParsedArgs } from 'minimist'
import Commands, { CommandOutputFormat } from '../commands.js';

export const ClientEndpoint = Type.Object({
    callsign: Type.String(),
    uid: Type.String(),
    username: Type.String(),
    team: Type.String(),
    role: Type.String(),
    lastStatus: Type.String(),
});

export default class Client extends Commands {
    schema = {
        list: {
            description: 'List Client Endpoints',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            return await this.list();
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(): Promise<Array<Static<typeof ClientEndpoint>>> {
        const url = new URL(`/Marti/api/clientEndPoints`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
