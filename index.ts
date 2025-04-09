import EventEmitter from 'node:events';
import tls from 'node:tls';
import CoT from '@tak-ps/node-cot';
import type { TLSSocket } from 'node:tls'

/* eslint-disable no-control-regex */
export const REGEX_CONTROL = /[\u000B-\u001F\u007F-\u009F]/g;

// Match <event .../> or <event> but not <events>
export const REGEX_EVENT = /(<event[ >][\s\S]*?<\/event>)([\s\S]*)/

/**
 * Store the TAK Client Certificate for a connection
 */
export interface TAKAuth {
    cert: string;
    key: string;
}

export interface PartialCoT {
    event: string;
    remainder: string;
}

export default class TAK extends EventEmitter {
    id: number | string;
    type: string;
    url: URL;
    auth: TAKAuth;
    open: boolean;
    destroyed: boolean;
    queue: string[];
    writing: boolean;

    pingInterval?: ReturnType<typeof setTimeout>;
    client?: TLSSocket;
    version?: string;

    constructor(
        id: number | string,
        type: string,
        url: URL,
        auth: TAKAuth
    ) {
        super();

        this.id = id;

        this.type = type;
        this.url = url;
        this.auth = auth;

        this.writing = false;

        this.open = false;
        this.destroyed = false;

        this.queue = [];
    }

    static async connect(id: number | string, url: URL, auth: TAKAuth): Promise<TAK> {
        const tak = new TAK(id, 'ssl', url, auth);

        if (url.protocol === 'ssl:') {
            if (!tak.auth.cert) throw new Error('auth.cert required');
            if (!tak.auth.key) throw new Error('auth.key required');
            return await tak.connect_ssl();
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    connect_ssl(): Promise<TAK> {
        return new Promise((resolve) => {
            this.destroyed = false;

            this.client = tls.connect({
                host: this.url.hostname,
                port: parseInt(this.url.port),
                rejectUnauthorized: false,
                cert: this.auth.cert,
                key: this.auth.key
            });

            this.client.setNoDelay();

            this.client.on('connect', () => {
                console.error(`ok - ${this.id} @ connect:${this.client ? this.client.authorized : 'NO CLIENT'} - ${this.client ? this.client.authorizationError : 'NO CLIENT'}`);
            });

            this.client.on('secureConnect', () => {
                console.error(`ok - ${this.id} @ secure:${this.client ? this.client.authorized : 'NO CLIENT'} - ${this.client ? this.client.authorizationError : 'NO CLIENT'}`);
                this.emit('secureConnect')
                this.ping();
            });

            let buff = '';
            this.client.on('data', (data: Buffer) => {
                // Eventually Parse ProtoBuf
                buff = buff + data.toString();

                let result = TAK.findCoT(buff);
                while (result && result.event) {
                    try {
                        const cot = new CoT(result.event);

                        if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                            this.open = true;
                            this.emit('ping');
                        } else if (
                            cot.raw.event._attributes.type === 't-x-takp-v'
                            && cot.raw.event.detail
                            && cot.raw.event.detail.TakControl
                            && cot.raw.event.detail.TakControl.TakServerVersionInfo
                            && cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes
                        ) {
                            this.version = cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                        } else {
                            this.emit('cot', cot);
                        }
                    } catch (e) {
                        console.error('Error parsing', e, data.toString());
                    }

                    buff = result.remainder;

                    result = TAK.findCoT(buff);
                }
            }).on('timeout', () => {
                this.emit('timeout');
            }).on('error', (err: Error) => {
                this.emit('error', err);
            }).on('end', () => {
                this.open = false;
                this.emit('end');
            });

            this.pingInterval = setInterval(() => {
                this.ping();
            }, 5000);

            return resolve(this);
        });
    }

    async reconnect(): Promise<void> {
        if (this.destroyed) {
            await this.connect_ssl();
        } else {
            this.destroy();
            await this.connect_ssl();
        }
    }

    destroy(): void {
        this.destroyed = true;
        if (this.client) {
            this.client.destroy();
        }

        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = undefined;
        }
    }

    async ping(): Promise<void> {
        this.write([CoT.ping()]);
    }

    writer(body: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.client) return reject(new Error('A Connection Client must first be created before it can be written'));

            const res: boolean = this.client.write(body + '\n', () => {
                return resolve(res)
            });
        });
    }

    async process(): Promise<void> {
        this.writing = true;
        while (this.queue.length) {
            const body = this.queue.shift()
            if (!body) continue;
            await this.writer(body);
        }

        await this.writer('');

        if (this.queue.length) {
            process.nextTick(() => {
                this.process();
            });
        } else {
            this.writing = false;
        }
    }

    /**
     * Write a CoT to the TAK Connection
     *
     * @param {CoT} cot CoT Object
     */
    write(cots: CoT[]): void {
        for (const cot of cots) {
            this.queue.push(cot.to_xml());
        }

        if (this.queue.length && !this.writing) {
            this.process();
        }
    }

    write_xml(body: string): void {
        this.queue.push(body);

        if (this.queue.length && !this.writing) {
            this.process();
        }
    }

    // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
    static findCoT(str: string): null | PartialCoT {
        str = str.replace(REGEX_CONTROL, "");

        const match = str.match(REGEX_EVENT); // find first CoT
        if (!match) return null;

        return {
            event: match[1],
            remainder: match[2],
        };
    }
}

export { CoT }
