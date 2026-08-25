import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate } from '../lib/auth.js';

type RequestArgs = Parameters<Client['request']>[0];

function mockResponse(statusCode: number, contentType: string, body: string | Buffer): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

async function collect(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

test('Certificate.listActive requests the active certificate list', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3',
            type: 'TakCert',
            data: [{ id: 1, hash: 'abc', userDn: 'alice' }],
            nodeId: 'node'
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Certificate.listActive();

        assert.ok(captured);
        // Sibling list*() methods leave the method unset - undici defaults to GET
        assert.equal(captured.method ?? 'GET', 'GET');
        assert.equal(captured.path, '/Marti/api/certadmin/cert/active');
        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].hash, 'abc');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.downloadIds streams the ZIP archive for the given IDs', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/zip', Buffer.from('zip-bytes'));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const body = await collect(await api.Certificate.downloadIds([1, '2', 3]));

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/certadmin/cert/download/1,2,3');
        assert.equal(body.toString(), 'zip-bytes');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.downloadIds rejects an empty ID list without a request', async () => {
    const originalRequest = Client.prototype.request;

    let called = false;
    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        called = true;
        return mockResponse(200, 'application/zip', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await assert.rejects(() => api.Certificate.downloadIds([]), /At least one ID must be provided/);
        assert.equal(called, false);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.downloadIds throws on a TAK Server error instead of streaming the error page', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(500, 'text/plain', 'exception in downloadCertificates!');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await assert.rejects(() => api.Certificate.downloadIds([1]), (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.equal((err as { status?: number }).status, 500);
            assert.match(err.message, /downloadCertificates/);
            return true;
        });
    } finally {
        Client.prototype.request = originalRequest;
    }
});
