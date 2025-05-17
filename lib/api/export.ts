import { Type, Static } from '@sinclair/typebox';
import { Readable } from 'node:stream';
import Commands from '../commands.js';

export const ExportInput = Type.Object({
    startTime: Type.String(),
    endTime: Type.String(),
    groups: Type.Array(Type.String()),
    format: Type.String({ enum: ['kmz', 'kml'] }),
    interval: Type.Optional(Type.Number()),
    multiTrackThreshold: Type.Optional(Type.String()),
    extendedData: Type.Optional(Type.Boolean()),
    optimizeExport: Type.Optional(Type.Boolean()),
});

/**
 * @class
 */
export default class ExportCommands extends Commands {
    schema = {};

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async export(query: Static<typeof ExportInput>): Promise<Readable> {
        const url = new URL(`/Marti/ExportMissionKML`, this.api.url);

        const params = new URLSearchParams();
        let q: keyof Static<typeof ExportInput>;
        for (q in query) {
            if (query[q] !== undefined ) {
                params.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'POST',
            body: params
        }, true);

        return res.body;
    }
}
