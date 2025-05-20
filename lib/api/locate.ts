import Commands from '../commands.js';
import { Type, Static } from '@sinclair/typebox';

export const LocateGenerateInput = Type.Object({
    latitude: Type.Number(),
    longitude: Type.Number(),
    name: Type.String(),
    remarks: Type.String()
});

export default class LocateCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async generate(query: Static<typeof LocateGenerateInput>): Promise<void> {
        const url = new URL(`/locate/api`, this.api.url);

        let q: keyof Static<typeof LocateGenerateInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'POST'
        });
    }

}
