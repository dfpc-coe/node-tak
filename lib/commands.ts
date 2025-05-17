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
        auth: Type.Optional(Type.Object({
            cert: Type.String(),
            key: Type.String()
        }))
    }))
})


export default class Commands {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    cli(args = {}): Promise<object> {
        if (!args) throw new Error('Args object must be provided');
        throw new Error('Command not yet supported');
    }
}
