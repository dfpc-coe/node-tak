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

// Self-signed test certificate: O=CO-TAK, OU=WILDFIRE, CN=alice@example.com, expires 2036-08-22
const FIXTURE_PEM = `-----BEGIN CERTIFICATE-----
MIIB1TCCAXugAwIBAgIUHPumta9q/l2whKqG1nGD9pJ/uogwCgYIKoZIzj0EAwIw
QDEPMA0GA1UECgwGQ08tVEFLMREwDwYDVQQLDAhXSUxERklSRTEaMBgGA1UEAwwR
YWxpY2VAZXhhbXBsZS5jb20wHhcNMjYwODI1MDEwNTQxWhcNMzYwODIyMDEwNTQx
WjBAMQ8wDQYDVQQKDAZDTy1UQUsxETAPBgNVBAsMCFdJTERGSVJFMRowGAYDVQQD
DBFhbGljZUBleGFtcGxlLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABB45
OnCT2nVQVxlgKDLttbhLW9Yjs2/elFjAZkil+iI0QLM+vtRjdoCdI+NhADggvJ65
+++JRYr8Kv2zwv2joSKjUzBRMB0GA1UdDgQWBBS8Depzqkj88/9GNHWY8GmyreFB
VTAfBgNVHSMEGDAWgBS8Depzqkj88/9GNHWY8GmyreFBVTAPBgNVHRMBAf8EBTAD
AQH/MAoGCCqGSM49BAMCA0gAMEUCIQCU1mg7e/Eu4A84SemDc0bIQHTnM9aVP8h1
LaburcgKWwIgYeKSRCQGrM1cEhJQbqJC6UWpJUGxGcclcMzGjqx7WpQ=
-----END CERTIFICATE-----`;
const FIXTURE_FINGERPRINT = '37:CA:5A:CD:2E:AC:F5:41:09:4B:DE:21:34:9F:A8:83:C4:43:20:71:7E:7F:CC:EC:97:2C:9E:AE:E9:5F:83:40';

function certList(certs: object[]): string {
    return JSON.stringify({ version: '3', type: 'TakCert', data: certs, nodeId: 'node' });
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

test('Certificate.validate reports a known, unrevoked, unexpired certificate as valid', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', certList([
            { id: 1, hash: 'AA:BB', userDn: 'alice@example.com', revocationDate: '2026-01-01T00:00:00.000Z' },
            // TAK stores uppercase hex - compare case-insensitively
            { id: 2, hash: FIXTURE_FINGERPRINT.toLowerCase(), userDn: 'alice@example.com' }
        ]));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Certificate.validate(FIXTURE_PEM);

        assert.ok(captured);
        assert.equal(captured.path, '/Marti/api/certadmin/cert?username=alice%40example.com');
        assert.equal(res.fingerprint, FIXTURE_FINGERPRINT);
        assert.equal(res.username, 'alice@example.com');
        assert.equal(res.expired, false);
        assert.equal(res.known, true);
        assert.equal(res.revoked, false);
        assert.equal(res.revocationDate, undefined);
        assert.equal(res.valid, true);
        assert.equal(res.certificate?.id, 2);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.validate reports a revoked certificate', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/json', certList([
            { id: 2, hash: FIXTURE_FINGERPRINT, userDn: 'alice@example.com', revocationDate: '2026-08-24T21:00:00.000Z' }
        ]));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Certificate.validate(FIXTURE_PEM);

        assert.equal(res.known, true);
        assert.equal(res.revoked, true);
        assert.equal(res.revocationDate, '2026-08-24T21:00:00.000Z');
        assert.equal(res.expired, false);
        assert.equal(res.valid, false);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.validate reports an unknown certificate as not revoked but not known', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/json', certList([]));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Certificate.validate(FIXTURE_PEM);

        assert.equal(res.known, false);
        assert.equal(res.revoked, false);
        assert.equal(res.certificate, undefined);
        assert.equal(res.valid, true);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.validate evaluates expiry locally against the supplied clock', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/json', certList([
            { id: 2, hash: FIXTURE_FINGERPRINT, userDn: 'alice@example.com' }
        ]));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Certificate.validate(FIXTURE_PEM, { now: new Date('2040-01-01T00:00:00Z') });

        assert.equal(res.expired, true);
        assert.equal(res.revoked, false);
        assert.equal(res.valid, false);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.validate rejects a PEM that is not a certificate', async () => {
    const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

    await assert.rejects(() => api.Certificate.validate('not a certificate'));
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
