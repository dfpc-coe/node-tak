import fetch from './fetch.js';
import { Type } from '@sinclair/typebox';
import { Client } from 'undici';
import type { Dispatcher, RequestInit } from 'undici';
import TAKAPI from './api.js';
import stream2buffer  from './stream.js';
import { encodeMultipartFormData } from './multipart.js';
import { typed } from './utils/typed.js';

type AuthFetchOptions = {
    headers?: Record<string, string | undefined>;
    credentials?: string;
    body?: unknown;
};


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
    // oxlint-disable-next-line eslint/no-unused-vars
    async init(api: TAKAPI) {

    }

    // oxlint-disable-next-line typescript/no-explicit-any
    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        return fetch(url, typed<RequestInit>(opts));
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

    // oxlint-disable-next-line typescript/no-explicit-any
    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const req = typed<AuthFetchOptions>(opts);

        req.headers ??= {};
        req.credentials = 'include';

        if (!req.headers.Authorization && this.jwt) {
            req.headers.Authorization = `Bearer ${this.jwt}`;
        }

        return fetch(url, typed<RequestInit>(req));
    }
}

export class APIAuthToken extends APIAuth {
    jwt?: string;

    constructor(jwt: string) {
        super();
        this.jwt = jwt;
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const req = typed<AuthFetchOptions>(opts);

        req.headers ??= {};
        req.credentials = 'include';

        if (!req.headers.Authorization && this.jwt) {
            req.headers.Authorization = `Bearer ${this.jwt}`;
        }

        return fetch(url, typed<RequestInit>(req));
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

    // oxlint-disable-next-line typescript/no-explicit-any
    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        let req = typed<AuthFetchOptions>(opts);

        const client = new Client(api.url.origin, {
            connect: {
                key: this.key,
                cert: this.cert,
                rejectUnauthorized: false,
            }
        });

        if (typeof FormData !== 'undefined' && req.body instanceof FormData) {
            const multipart = await encodeMultipartFormData(req.body);
            req = {
                ...req,
                headers: {
                    ...req.headers,
                    ...multipart.headers
                },
                body: multipart.body
            };
        }

        const res = await client.request({
            // undici's Client.request requires a method - default to GET like fetch()
            method: 'GET',
            path: String(url).replace(api.url.origin, ''),
            ...typed<Partial<Dispatcher.RequestOptions>>(req)
        });

        return {
            status: res.statusCode,
            body: res.body,
            // Make this similiar to the fetch standard
            headers: new Map(Object.entries(res.headers)),
            text: async () => {
                return String(await stream2buffer(res.body));
            },
            json: async (): Promise<unknown> => {
                return JSON.parse(String(await stream2buffer(res.body)));
            },
        };
    }
}

