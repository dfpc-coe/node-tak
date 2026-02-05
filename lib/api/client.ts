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

export const ClientListQuery = Type.Object({
    secAgo: Type.Optional(Type.Integer({ default: 0 })),
    showCurrentlyConnectedClients: Type.Optional(Type.String({ default: "false" })),
    showMostRecentOnly: Type.Optional(Type.String({ default: "false" })),
    group: Type.Optional(Type.Array(Type.String()))
});

export default class Client extends Commands {
    schema = {
        list: {
            description: 'List Client Endpoints',
            params: Type.Object({}),
            query: ClientListQuery,
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            return await this.list({
                secAgo: args.secAgo,
                showCurrentlyConnectedClients: args.showCurrentlyConnectedClients ? String(args.showCurrentlyConnectedClients) : undefined,
                showMostRecentOnly: args.showMostRecentOnly ? String(args.showMostRecentOnly) : undefined,
                group: args.group ? (Array.isArray(args.group) ? args.group : [args.group]) : undefined
            });
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(query: Static<typeof ClientListQuery> = {}): Promise<Array<Static<typeof ClientEndpoint>>> {
        const url = new URL(`/Marti/api/clientEndPoints`, this.api.url);

        if (query.secAgo) url.searchParams.append('secAgo', String(query.secAgo));
        if (query.showCurrentlyConnectedClients) url.searchParams.append('showCurrentlyConnectedClients', query.showCurrentlyConnectedClients);
        if (query.showMostRecentOnly) url.searchParams.append('showMostRecentOnly', query.showMostRecentOnly);

        if (query.group) {
            for (const group of query.group) {
                url.searchParams.append('group', group);
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
