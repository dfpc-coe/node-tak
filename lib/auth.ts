import fetch from './fetch.js';
import { Type } from '@sinclair/typebox';
import { Client } from 'undici';
import TAKAPI from './api.js';
import stream2buffer  from './stream.js';

/**
 * Store the TAK Client Certificate for a connection
 */
export const TAKAuth = Type.Object({
    cert: Type.String(),
    key: Type.String(),
    passphrase: Type.Optional(Type.String()),
    ca: Type.Optional(Type.String()),
    rejectUnauthorized: Type.Optional(Type.Boolean())
})

export class APIAuth {
    async init(api: TAKAPI) { // eslint-disable-line @typescript-eslint/no-unused-vars

    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        return await fetch(url, opts);
    }
}

export class APIAuthPassword extends APIAuth {
    username: string;
    password: string;
    jwt: string;

    constructor(username: string, password: string) {
        super();
        this.username = username;
        this.password = password;
        this.jwt = '';
    }

    async init(api: TAKAPI) {
        const { token } = await api.OAuth.login({
            username: this.username,
            password: this.password
        })

        this.jwt = token;
    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        opts.headers = opts.headers || {}
        opts.credentials = 'include';

        if (!opts.headers.Authorization && this.jwt) {
            opts.headers.Authorization = `Bearer ${this.jwt}`;
        }

        console.error('OPTIONS', opts);


        return await fetch(url, opts);
    }
}

export class APIAuthToken extends APIAuth {
    jwt?: string;

    constructor(jwt: string) {
        super();
        this.jwt = jwt;
    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        opts.headers = opts.headers || {}
        opts.credentials = 'include';

        if (!opts.headers.Authorization && this.jwt) {
            opts.headers.Authorization = `Bearer ${this.jwt}`;
        }

        console.error('OPTIONS', opts);

        return await fetch(url, opts);
    }
}

export class APIAuthCertificate extends APIAuth {
    cert: string;
    key: string;

    constructor(cert: string, key: string) {
        super();
        this.cert = cert;
        this.key = key;
    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const client = new Client(api.url.origin, {
            connect: {
                key: this.key,
                cert: this.cert,
                rejectUnauthorized: false,
            }
        });

        const res = await client.request({
            path: String(url).replace(api.url.origin, ''),
            ...opts
        });

        return {
            status: res.statusCode,
            body: res.body,
            // Make this similiar to the fetch standard
            headers: new Map(Object.entries(res.headers)),
            text: async () => {
                return String(await stream2buffer(res.body));
            },
            json: async () => {
                return JSON.parse(String(await stream2buffer(res.body)));
            },
        };
    }
}

