import { Static, Type } from '@sinclair/typebox';
import type { ParsedArgs } from 'minimist'
import { TAKList } from './types.js';
import Commands from '../commands.js';

export const Group = Type.Object({
    name: Type.String(),
    direction: Type.String(),
    created: Type.String(),
    type: Type.String(),
    bitpos: Type.Number(),
    active: Type.Boolean(),
    description: Type.Optional(Type.String())
})

export const GroupListInput = Type.Object({
    useCache: Type.Optional(Type.Boolean())
})

export const TAKList_Group = TAKList(Group);

export default class GroupCommands extends Commands {
    async cli(args: ParsedArgs): Promise<object | string> {
        if (!args._[3] || args._[3] === 'help') {
            return [
                `Command: tak ${args._[2]} <subcommand>`,
                'SubCommands:',
                '    list - List Missions',
                'Args:',
                '    --format json'
            ].join('\n') + '\n';
        } else if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((channel) => {
                    return `${channel.name} - ${channel.description}`;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(
        query: Static<typeof GroupListInput> = {}
    ): Promise<Static<typeof TAKList_Group>> {
        const url = new URL(`/Marti/api/groups/all`, this.api.url);

        let q: keyof Static<typeof GroupListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async update(
        body: Static<typeof Group>[],
        query: Static<typeof GroupListInput> = {}
    ): Promise<void> {
        const url = new URL(`/Marti/api/groups/active`, this.api.url);

        let q: keyof Static<typeof GroupListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }
}
