import { TAKAuth } from '../index.js';
import TAKAPI from './api.js';
import { Type } from '@sinclair/typebox';

export const CommandConfig = Type.Object({
    version: Type.Integer(),
    profiles: Type.Record(Type.String(), Type.Object({
        host: Type.String(),
        ports: Type.Object({
            marti: Type.Integer(),
            webtak: Type.Integer(),
            stream: Type.Integer()
        }),
        auth: Type.Optional(TAKAuth)
    }))
})


export default class Commands {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async cli(args = {}): Promise<object> {
        if (!args) throw new Error('Args object must be provided');
        throw new Error('Command not yet supported');
    }
}
