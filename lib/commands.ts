import { TAKAuth } from './auth.js';
import TAKAPI from './api.js';
import type { TObject } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export type ParsedArgValue = string | boolean;
export type ParsedArgs = {
    _: string[];
    [key: string]: ParsedArgValue | ParsedArgValue[] | undefined;
};

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
        // oxlint-disable-next-line typescript/no-explicit-any
        params: TObject<any>,
        // oxlint-disable-next-line typescript/no-explicit-any
        query: TObject<any>,
        formats: Array<CommandOutputFormat>
    }> = {};

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args === undefined || args === null) throw new Error('Args object must be provided');
        throw new Error('Command not yet supported');
    }
}
