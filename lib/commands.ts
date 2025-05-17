import { TAKAuth } from './auth.js';
import type { ParsedArgs } from 'minimist';
import TAKAPI from './api.js';
import type { TObject } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export const CommandConfig = Type.Object({
    version: Type.Integer(),
    profiles: Type.Record(
        Type.String(),
        Type.Object({
            host: Type.String(),
            ports: Type.Object({
                marti: Type.Integer(),
                webtak: Type.Integer(),
                stream: Type.Integer()
            }),
            auth: Type.Optional(TAKAuth)
        })
    )
})

export enum CommandOutputFormat {
    JSON = 'json',
    GEOJSON = 'geojson',
    XML = 'xml',
    BINARY = 'binary'
}

export default class Commands {
    api: TAKAPI;

    schema: Record<string, {
        description: string,
        params: TObject<any>,
        query: TObject<any>,
        formats: Array<CommandOutputFormat>
    }> = {};

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (!args) throw new Error('Args object must be provided');
        throw new Error('Command not yet supported');
    }
}
