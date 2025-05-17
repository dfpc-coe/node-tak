import { Type, Static } from '@sinclair/typebox';
import type { ParsedArgs } from 'minimist'
import Commands from '../commands.js';

export const Contact = Type.Object({
    filterGroups: Type.Any(), // I'm not familiar with this one
    notes: Type.String(),
    callsign: Type.String(),
    team: Type.String(),
    role: Type.String(),
    takv: Type.String(),
    uid: Type.String()
});

export default class ContactCommands extends Commands {
    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();
            if (args.format === 'json') {
                return list;
            } else {
                return list.map((contact) => {
                    return `${contact.callsign || '<No Callsign Set>'} (${contact.notes.trim()})`;
                }).join('\n');
            }
        } else if (!args._[3] || args._[3] === 'help') {
            return [
                `Command: tak ${args._[1]} <subcommand>`,
                'SubCommands:',
                '    list - List Contacts',
                'Args:',
                '    --format json'
            ].join('\n') + '\n';
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(): Promise<Array<Static<typeof Contact>>> {
        const url = new URL(`/Marti/api/contacts/all`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
