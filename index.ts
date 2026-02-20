import type { Static } from '@sinclair/typebox';
import type { CoTOptions } from '@tak-ps/node-cot';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import EventEmitter from 'node:events';
import type { TLSSocket } from 'node:tls';
import tls from 'node:tls';

import TAKAPI from './lib/api.js';
import { TAKAuth } from './lib/auth.js';
import { Queue } from './lib/utils/queue.js';
export * from './lib/auth.js';

/* eslint-disable no-control-regex */
export const REGEX_CONTROL = /[\u000B-\u001F\u007F-\u009F]/g;

// Match <event .../> or <event> but not <events>
export const REGEX_EVENT = /(<event[ >][\s\S]*?<\/event>)([\s\S]*)/;

export interface PartialCoT {
    event: string;
    remainder: string;
}

/**
 * Configuration options for a TAK connection.
 *
 * Performance-related options control the write pipeline:
 *
 * ```
 * write(cots)                                process()
 * ───────────                                ─────────
 *  for each CoT:                             while queue has items:
 *    serialize to XML ──push()──►  Ring        pop socketBatchSize items
 *    (returns false   ◄────────   Buffer       join into one string
 *     when full)               (capacity =     socket.write(batch)
 *                          writeQueueSize)     stop if backpressure
 *  when full:
 *    setImmediate() yield                    triggered by:
 *    (lets process() drain)                    - write() calling process()
 *                                              - socket 'drain' event
 * ```
 *
 * @example High-throughput bulk ingestion
 * ```typescript
 * const tak = await TAK.connect(url, auth, {
 *     writeQueueSize: 50_000,   // large buffer absorbs bursts
 *     socketBatchSize: 128,     // 128 strings per socket.write()
 * });
 * ```
 *
 * @example Low-latency real-time streams
 * ```typescript
 * const tak = await TAK.connect(url, auth, {
 *     writeQueueSize: 400,      // small buffer keeps memory minimal
 *     socketBatchSize: 10,      // flush to socket every 10 items
 * });
 * ```
 */
export type TAKOptions = {
    /** Unique connection identifier. Appears in log messages for debugging.
     *  Useful when running multiple TAK connections in a single process.
     *  @default crypto.randomUUID() */
    id?: number | string;

    /** Connection type label. Informational only — helps distinguish
     *  connections in logs when multiple are active.
     *  @default 'unknown' */
    type?: string;

    /** Options passed through to `@tak-ps/node-cot` for CoT parsing
     *  (e.g., on incoming `'cot'` events). Does not affect the write pipeline. */
    cot?: CoTOptions;

    /** Capacity of the ring buffer that sits between `write()` and `process()`.
     *  When the queue is full, `write()` yields via `setImmediate()` until
     *  `process()` drains space. Larger values allow more XML strings to be
     *  buffered, increasing throughput at the cost of higher peak memory.
     *  @default 10_000 */
    writeQueueSize?: number;

    /** How many pre-serialized XML strings are popped from the ring buffer
     *  and joined into a single `socket.write()` call in `process()`. Higher
     *  values reduce syscall overhead and improve TLS frame packing, but
     *  increase per-write latency and the size of each socket write.
     *  @default 64 */
    socketBatchSize?: number;
};

const DEFAULT_WRITE_QUEUE_SIZE = 10_000;
const DEFAULT_SOCKET_BATCH_SIZE = 64;

export default class TAK extends EventEmitter {
    id: number | string;
    type: string;
    url: URL;
    auth: Static<typeof TAKAuth>;
    open: boolean;
    destroyed: boolean;
    writing: boolean;
    writeQueueSize: number;
    socketBatchSize: number;

    cotOptions: CoTOptions;

    pingInterval?: ReturnType<typeof setTimeout>;
    client?: TLSSocket;
    version?: string;

    // Hybrid pipeline:
    //   write() serializes CoTs upfront into a bounded ring buffer of XML strings.
    //   process() drains the ring buffer to the socket, driven by drain events.
    //   Fully caller-safe: CoT objects can be mutated/GC'd after write() returns.
    queue: Queue<string>;

    /**
     * @param url   - Full URL of Streaming COT Endpoint IE: "https://ops.cotak.gov:8089"
     * @param auth  - TAK Certificate Pair
     * @param opts  - Options Object
     * @param opts.id   - When using multiple connections in a script, allows a unique ID per connection
     * @param opts.type - When using multiple connections in a script, allows specifying a script provided connection type
     */
    constructor(url: URL, auth: Static<typeof TAKAuth>, opts: TAKOptions = {}) {
        super();

        if (!opts) opts = {};

        this.id = opts.id || crypto.randomUUID();
        this.type = opts.type || 'unknown';

        this.url = url;
        this.auth = auth;

        this.writing = false;
        this.writeQueueSize = opts.writeQueueSize || DEFAULT_WRITE_QUEUE_SIZE;
        this.socketBatchSize =
            opts.socketBatchSize || DEFAULT_SOCKET_BATCH_SIZE;

        this.cotOptions = opts.cot || {};

        this.open = false;
        this.destroyed = false;
        this.queue = new Queue<string>(this.writeQueueSize);
    }

    static async connect(
        url: URL,
        auth: Static<typeof TAKAuth>,
        opts: TAKOptions = {},
    ): Promise<TAK> {
        const tak = new TAK(url, auth, opts);

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
                rejectUnauthorized: this.auth.rejectUnauthorized ?? false,
                cert: this.auth.cert,
                key: this.auth.key,
                passphrase: this.auth.passphrase,
                ca: this.auth.ca,
            });

            this.client.setNoDelay();

            this.client.on('connect', () => {
                console.error(
                    `ok - ${this.id} @ connect:${this.client ? this.client.authorized : 'NO CLIENT'} - ${this.client ? this.client.authorizationError : 'NO CLIENT'}`,
                );
            });

            this.client.on('secureConnect', () => {
                console.error(
                    `ok - ${this.id} @ secure:${this.client ? this.client.authorized : 'NO CLIENT'} - ${this.client ? this.client.authorizationError : 'NO CLIENT'}`,
                );
                this.emit('secureConnect');
                this.ping();
            });

            let buff = '';
            this.client
                .on('data', async (data: Buffer) => {
                    // Eventually Parse ProtoBuf
                    buff = buff + data.toString();

                    let result = TAK.findCoT(buff);
                    while (result && result.event) {
                        try {
                            const cot = CoTParser.from_xml(
                                result.event,
                                this.cotOptions,
                            );

                            if (
                                cot.raw.event._attributes.type === 't-x-c-t-r'
                            ) {
                                this.open = true;
                                this.emit('ping');
                            } else if (
                                cot.raw.event._attributes.type ===
                                    't-x-takp-v' &&
                                cot.raw.event.detail &&
                                cot.raw.event.detail.TakControl &&
                                cot.raw.event.detail.TakControl
                                    .TakServerVersionInfo &&
                                cot.raw.event.detail.TakControl
                                    .TakServerVersionInfo._attributes
                            ) {
                                this.version =
                                    cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                            } else {
                                this.emit('cot', cot);
                            }
                        } catch (e) {
                            console.error('Error parsing', e, data.toString());
                        }

                        buff = result.remainder;

                        result = TAK.findCoT(buff);
                    }
                })
                .on('timeout', () => {
                    this.emit('timeout');
                })
                .on('error', (err: Error) => {
                    console.error(`[socket] error:`, err.message);
                    this.emit('error', err);
                })
                .on('end', () => {
                    this.open = false;
                    this.emit('end');
                    if (!this.destroyed) {
                        this.destroy();
                    }
                })
                .on('close', () => {
                    if (!this.destroyed) {
                        this.destroy();
                    }
                })
                .on('drain', () => {
                    this.process();
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
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
        }

        // Unblock any flush() waiters
        this.emit('_flushed');
    }

    async ping(): Promise<void> {
        this.write([CoT.ping()]);
    }

    /**
     * Drain the queue to the socket.
     *
     * Pops pre-serialized XML strings from the ring buffer, batches them
     * (up to `socketBatchSize` per call), and writes to the socket. Runs
     * synchronously in a single event loop tick until the socket signals
     * backpressure or the queue is empty.
     *
     * Called when the socket signals readiness:
     *   - `'drain'` event (socket buffer cleared, ready for more)
     *   - After `write()` enqueues new items
     *
     * Emits `'_flushed'` when the queue drains to zero, waking any
     * pending `flush()` calls.
     */
    process(): void {
        if (this.writing) return;
        if (!this.client || this.destroyed) return;
        this.writing = true;

        try {
            while (this.queue.length > 0) {
                if (this.destroyed || !this.client) break;
                if (this.client.writableNeedDrain) break;

                const batchCount = Math.min(
                    this.socketBatchSize,
                    this.queue.length,
                );
                const parts: string[] = new Array(batchCount);
                for (let i = 0; i < batchCount; i++) {
                    const xml = this.queue.pop();
                    if (!xml) break;
                    parts[i] = xml;
                }

                const ok = this.client.write(parts.join('\n') + '\n');
                if (!ok) break;
            }
        } catch (err) {
            this.destroy();
            this.emit('error', err);
        } finally {
            this.writing = false;

            // Safety net: if a drain event fired while writing=true (and was
            // therefore ignored), re-check. If the socket has capacity, reschedule
            // on the next event loop turn so I/O callbacks can run first.
            if (
                this.queue.length > 0 &&
                !this.destroyed &&
                this.client &&
                !this.client.writableNeedDrain
            ) {
                setImmediate(() => this.process());
            }

            if (this.queue.length === 0) {
                this.emit('_flushed');
            }
        }
    }

    /**
     * Write CoTs to the TAK connection.
     *
     * Serializes each CoT to XML upfront and stores the string in a bounded
     * ring buffer. Fully caller-safe: CoT objects can be mutated or GC'd
     * immediately after this returns.
     * Resolves when all items are queued (not when sent over the wire).
     * Use flush() to wait for delivery.
     *
     * @param cots Array of CoT objects to send
     */
    async write(cots: CoT[]): Promise<void> {
        for (let i = 0; i < cots.length; ) {
            if (this.destroyed) return;

            // Serialize upfront and push XML strings into the ring buffer
            while (
                i < cots.length &&
                this.queue.push(CoTParser.to_xml(cots[i]))
            ) {
                i++;
            }

            // Kick process to start draining
            this.process();

            // Queue full — yield to let process() drain via I/O callbacks,
            // then retry on the next event loop turn.
            if (i < cots.length) {
                await new Promise<void>((resolve) => setImmediate(resolve));
            }
        }
    }

    /**
     * Wait until all queued CoTs have been flushed to the socket.
     *
     * write() is a fast "enqueue" — it returns once items are in the queue,
     * NOT once they've been sent over the wire.
     *
     * Resolves immediately if nothing is queued.
     * Rejects if the connection is destroyed before flush completes.
     */
    async flush(): Promise<void> {
        if (this.queue.length === 0 && !this.writing) return;

        return new Promise<void>((resolve, reject) => {
            const check = () => {
                if (this.destroyed) {
                    cleanup();
                    reject(
                        new Error(
                            'connection destroyed before flush completed',
                        ),
                    );
                } else if (this.queue.length === 0 && !this.writing) {
                    cleanup();
                    resolve();
                }
            };
            const cleanup = () => {
                this.removeListener('_flushed', check);
            };
            this.on('_flushed', check);
            check();
        });
    }

    write_xml(body: string): void {
        this.queue.push(body);

        if (this.queue.length > 0 && !this.writing) {
            this.process();
        }
    }

    // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
    static findCoT(str: string): null | PartialCoT {
        str = str.replace(REGEX_CONTROL, '');

        const match = str.match(REGEX_EVENT); // find first CoT
        if (!match) return null;

        return {
            event: match[1],
            remainder: match[2],
        };
    }
}

export * from './lib/api.js';
export { CommandOutputFormat } from './lib/commands.js';
export { CoT, TAKAPI };
