import { Type, Static } from '@sinclair/typebox';
import Commands, { CommandOutputFormat, type ParsedArgs } from '../commands.js';
import { typed } from '../utils/typed.js';

export const Contact = Type.Object({
    // I'm not familiar with this one
    filterGroups: Type.Any(),
    notes: Type.String(),
    callsign: Type.String(),
    team: Type.String(),
    role: Type.String(),
    takv: Type.String(),
    uid: Type.String()
});

export default class ContactCommands extends Commands {
    schema = {
        list: {
            description: 'List Contacts',
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

            return list.map((contact) => {
                return `${contact.callsign || '<No Callsign Set>'} (${contact.notes.trim()})`;
            }).join('\n');
        }

        throw new Error('Unsupported Subcommand');
    }

    async list(): Promise<Array<Static<typeof Contact>>> {
        const url = new URL(`/Marti/api/contacts/all`, this.api.url);
        return typed<Array<Static<typeof Contact>>>(await this.api.fetch(url, {
            method: 'GET'
        }));
    }
}
