import { Type, Static } from '@sinclair/typebox';
import type { ParsedArgs } from 'minimist'
import Commands, { CommandOutputFormat } from '../commands.js';

export const Package = Type.Object({
    EXPIRATION: Type.String(),
    UID: Type.String(),
    SubmissionDateTime: Type.String(),
    Keywords: Type.Array(Type.String()),
    MIMEType: Type.String(),
    Size: Type.String(),
    SubmissionUser: Type.String(),
    PrimaryKey: Type.String(),
    Hash: Type.String(),
    CreatorUid: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    Name: Type.String(),
    Tool: Type.String()
});

export const ListInput = Type.Object({
    tool: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
});

/**
 * @class
 */
export default class PackageCommands extends Commands {
    schema = {
        list: {
            description: 'List Data Packages',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list({});

            if (args.format === 'json') {
                return list;
            } else {
                return list.results.map((data) => {
                    return data.Name;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(query: Static<typeof ListInput>): Promise<{
        resultCount: number;
        results: Array<Static<typeof Package>>
    }> {
        const url = new URL(`/Marti/sync/search`, this.api.url);

        let q: keyof Static<typeof ListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return JSON.parse(res) as {
            resultCount: number;
            results: Array<Static<typeof Package>>
        };
    }
}
