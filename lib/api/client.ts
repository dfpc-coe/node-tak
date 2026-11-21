import { Type, Static } from '@sinclair/typebox';
import { TAKList } from './types.js';
import Commands, { CommandOutputFormat, type ParsedArgs } from '../commands.js';
import { typed } from '../utils/typed.js';

export const ClientEndpoint = Type.Object({
    callsign: Type.String(),
    uid: Type.String(),
    username: Type.String(),
    team: Type.String(),
    role: Type.String(),
    lastStatus: Type.String(),
});

export const ClientEndpointList = TAKList(ClientEndpoint);

export const ClientListQuery = Type.Object({
    secAgo: Type.Optional(Type.Integer({ default: 0 })),
    showCurrentlyConnectedClients: Type.Optional(Type.String({ default: "false" })),
    showMostRecentOnly: Type.Optional(Type.String({ default: "false" })),
    group: Type.Optional(Type.Array(Type.String()))
});

function isSet(value: ParsedArgs[string]): boolean {
    return value !== undefined && value !== false && value !== '';
}

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
            const secAgo = typeof args.secAgo === 'string' ? Number(args.secAgo) : undefined;
            const group =
                typeof args.group === 'string'
                    ? [args.group]
                    : Array.isArray(args.group)
                        ? args.group.filter((value): value is string => typeof value === 'string')
                        : undefined;

            return this.list({
                secAgo: secAgo !== undefined && Number.isNaN(secAgo) ? undefined : secAgo,
                showCurrentlyConnectedClients: isSet(args.showCurrentlyConnectedClients) ? String(args.showCurrentlyConnectedClients) : undefined,
                showMostRecentOnly: isSet(args.showMostRecentOnly) ? String(args.showMostRecentOnly) : undefined,
                group
            });
        }

        throw new Error('Unsupported Subcommand');
    }

    async list(query: Static<typeof ClientListQuery> = {}): Promise<Static<typeof ClientEndpointList>> {
        const url = new URL(`/Marti/api/clientEndPoints`, this.api.url);

        if (query.secAgo !== undefined && query.secAgo !== 0 && !Number.isNaN(query.secAgo)) url.searchParams.append('secAgo', String(query.secAgo));
        if (query.showCurrentlyConnectedClients) url.searchParams.append('showCurrentlyConnectedClients', query.showCurrentlyConnectedClients);
        if (query.showMostRecentOnly) url.searchParams.append('showMostRecentOnly', query.showMostRecentOnly);

        if (query.group) {
            for (const group of query.group) {
                url.searchParams.append('group', group);
            }
        }

        return typed<Static<typeof ClientEndpointList>>(await this.api.fetch(url, {
            method: 'GET'
        }));
    }
}
