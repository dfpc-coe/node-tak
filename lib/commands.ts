import TAKAPI from './api.js';

export default class Commands {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    commands(args = {}): Promise<object> {
        if (!args) throw new Error('Args object must be provided');
        throw new Error('Command not yet supported');
    }
}
