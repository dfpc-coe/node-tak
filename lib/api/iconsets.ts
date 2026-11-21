import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import Commands, { CommandOutputFormat, type ParsedArgs } from '../commands.js';
import { typed } from '../utils/typed.js';

export const TAKList_Iconsets = TAKList(Type.String());

export default class InjectorCommands extends Commands {
    schema = {
        list: {
            description: 'List Iconsets',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            }

            return list.data.map((iconset) => {
                return iconset;
            }).join('\n');
        }

        throw new Error('Unsupported Subcommand');
    }

    /**
     * Return a list of iconset UIDs
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/iconset-icon-api/operation/getAllIconsetUids TAK Server Docs}.
     */
    async list(): Promise<Static<typeof TAKList_Iconsets>> {
        const url = new URL('/Marti/api/iconset/all/uid', this.api.url);

        return typed<Static<typeof TAKList_Iconsets>>(await this.api.fetch(url, {
            method: 'GET'
        }));
    }
}
