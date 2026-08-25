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
const GET_PATH = `/Marti/api/certadmin/cert/${FIXTURE_FINGERPRINT}`;
const LIST_PATH = '/Marti/api/certadmin/cert?username=alice%40example.com';

function certList(certs: object[]): string {
    return JSON.stringify({ version: '3', type: 'TakCert', data: certs, nodeId: 'node' });
}

function certItem(cert: object): string {
    return JSON.stringify({ version: '3', type: 'TakCert', data: cert, nodeId: 'node' });
}

// Tomcat's default page for response.sendError(500) - what the TAK Server
// returns from getCertificate() when the hash is unknown
const TOMCAT_500 = '<!doctype html><html lang="en"><head><title>HTTP Status 500 – Internal Server Error</title></head><body><h1>HTTP Status 500 – Internal Server Error</h1></body></html>';

async function collect(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

/**
 * Install a path-keyed mock; returns the list of paths requested in order
 */
function mockRoutes(routes: Record<string, () => Dispatcher.ResponseData>): { paths: string[]; restore: () => void } {
    const originalRequest = Client.prototype.request;
    const paths: string[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        const path = String(opts.path);
        paths.push(path);
        const route = routes[path];
        if (!route) throw new Error(`Unexpected request: ${opts.method ?? 'GET'} ${path}`);
        return route();
    };

    return { paths, restore: () => { Client.prototype.request = originalRequest; } };
}

function api(): TAKAPI {
    return new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));
}

test('Certificate.listActive requests the active certificate list', async () => {
    const mock = mockRoutes({
        '/Marti/api/certadmin/cert/active': () => mockResponse(200, 'application/json', certList([{ id: 1, hash: 'abc', userDn: 'alice' }]))
    });

    try {
        const res = await api().Certificate.listActive();

        assert.deepEqual(mock.paths, ['/Marti/api/certadmin/cert/active']);
        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].hash, 'abc');
    } finally {
        mock.restore();
    }
});

test('Certificate.validate resolves a known certificate with a single get(hash) call', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(200, 'application/json', certItem({ id: 2, hash: FIXTURE_FINGERPRINT, userDn: 'alice@example.com' }))
    });

    try {
        const res = await api().Certificate.validate(FIXTURE_PEM);

        assert.deepEqual(mock.paths, [GET_PATH]);
        assert.equal(res.fingerprint, FIXTURE_FINGERPRINT);
        assert.equal(res.username, 'alice@example.com');
        assert.equal(res.expired, false);
        assert.equal(res.known, true);
        assert.equal(res.revoked, false);
        assert.equal(res.revocationDate, undefined);
        assert.equal(res.valid, true);
        assert.equal(res.certificate?.id, 2);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate reports a revoked certificate', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(200, 'application/json', certItem({ id: 2, hash: FIXTURE_FINGERPRINT, userDn: 'alice@example.com', revocationDate: '2026-08-24T21:00:00.000Z' }))
    });

    try {
        const res = await api().Certificate.validate(FIXTURE_PEM);

        assert.equal(res.known, true);
        assert.equal(res.revoked, true);
        assert.equal(res.revocationDate, '2026-08-24T21:00:00.000Z');
        assert.equal(res.expired, false);
        assert.equal(res.valid, false);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate falls back to the user list when get(hash) answers 500 and matches case-insensitively', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(500, 'text/html', TOMCAT_500),
        [LIST_PATH]: () => mockResponse(200, 'application/json', certList([
            { id: 1, hash: 'AA:BB', userDn: 'alice@example.com', revocationDate: '2026-01-01T00:00:00.000Z' },
            { id: 2, hash: FIXTURE_FINGERPRINT.toLowerCase(), userDn: 'alice@example.com' }
        ]))
    });

    try {
        const res = await api().Certificate.validate(FIXTURE_PEM);

        assert.deepEqual(mock.paths, [GET_PATH, LIST_PATH]);
        assert.equal(res.known, true);
        assert.equal(res.revoked, false);
        assert.equal(res.valid, true);
        assert.equal(res.certificate?.id, 2);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate reports an unknown certificate as not revoked but not known', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(500, 'text/html', TOMCAT_500),
        [LIST_PATH]: () => mockResponse(200, 'application/json', certList([]))
    });

    try {
        const res = await api().Certificate.validate(FIXTURE_PEM);

        assert.deepEqual(mock.paths, [GET_PATH, LIST_PATH]);
        assert.equal(res.known, false);
        assert.equal(res.revoked, false);
        assert.equal(res.certificate, undefined);
        assert.equal(res.valid, true);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate rethrows non-500 failures from get(hash) without consulting the list', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(403, 'text/plain', 'Forbidden')
    });

    try {
        await assert.rejects(() => api().Certificate.validate(FIXTURE_PEM), (err: unknown) => {
            assert.equal((err as { status?: number }).status, 403);
            return true;
        });
        assert.deepEqual(mock.paths, [GET_PATH]);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate evaluates expiry locally against the supplied clock', async () => {
    const mock = mockRoutes({
        [GET_PATH]: () => mockResponse(200, 'application/json', certItem({ id: 2, hash: FIXTURE_FINGERPRINT, userDn: 'alice@example.com' }))
    });

    try {
        const res = await api().Certificate.validate(FIXTURE_PEM, { now: new Date('2040-01-01T00:00:00Z') });

        assert.equal(res.expired, true);
        assert.equal(res.revoked, false);
        assert.equal(res.valid, false);
    } finally {
        mock.restore();
    }
});

test('Certificate.validate rejects a PEM that is not a certificate', async () => {
    await assert.rejects(() => api().Certificate.validate('not a certificate'));
});

test('Certificate.probe reports accepted credentials with the server version', async () => {
    const mock = mockRoutes({
        '/Marti/api/version': () => mockResponse(200, 'text/plain', 'TAK Server 5.4-RELEASE-1\n')
    });

    try {
        const res = await api().Certificate.probe();

        assert.deepEqual(mock.paths, ['/Marti/api/version']);
        assert.deepEqual(res, { accepted: true, version: 'TAK Server 5.4-RELEASE-1' });
    } finally {
        mock.restore();
    }
});

test('Certificate.probe classifies a RevokedException error page as revoked', async () => {
    const mock = mockRoutes({
        '/Marti/api/version': () => mockResponse(500, 'text/html', [
            '<!doctype html><html lang="en"><head><title>HTTP Status 500 – Internal Server Error</title></head><body>',
            '<h1>HTTP Status 500 – Internal Server Error</h1><p><b>Type</b> Exception Report</p>',
            '<p><b>Message</b> Exception performing TAK Server authentication</p>',
            '<p><b>Exception</b></p><pre>org.springframework.security.authentication.BadCredentialsException: Exception performing TAK Server authentication</pre>',
            '<p><b>Root Cause</b></p><pre>com.bbn.marti.remote.exception.RevokedException: Attempt to use revoked certificate : CN=alice@example.com,OU=WILDFIRE,O=CO-TAK</pre>',
            '</body></html>'
        ].join(''))
    });

    try {
        const res = await api().Certificate.probe();

        assert.equal(res.accepted, false);
        assert.equal(res.reason, 'revoked');
        assert.ok(res.message);
    } finally {
        mock.restore();
    }
});

test('Certificate.probe classifies a BadCredentialsException without a revocation cause as rejected', async () => {
    const mock = mockRoutes({
        '/Marti/api/version': () => mockResponse(500, 'text/plain', 'org.springframework.security.authentication.BadCredentialsException: Exception performing TAK Server authentication')
    });

    try {
        const res = await api().Certificate.probe();

        assert.equal(res.accepted, false);
        assert.equal(res.reason, 'rejected');
    } finally {
        mock.restore();
    }
});

test('Certificate.probe classifies a TLS handshake failure as tls', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        const err = new Error('fetch failed') as Error & { cause?: Error };
        err.cause = Object.assign(new Error('write EPROTO SSL routines:ssl3_read_bytes:sslv3 alert bad certificate'), { code: 'EPROTO' });
        throw err;
    };

    try {
        const res = await api().Certificate.probe();

        assert.equal(res.accepted, false);
        assert.equal(res.reason, 'tls');
        assert.match(res.message ?? '', /EPROTO/);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Certificate.probe rethrows errors that are not authentication failures', async () => {
    const mock = mockRoutes({
        '/Marti/api/version': () => mockResponse(503, 'text/plain', 'Service Unavailable')
    });

    try {
        await assert.rejects(() => api().Certificate.probe(), (err: unknown) => {
            assert.equal((err as { status?: number }).status, 503);
            return true;
        });
    } finally {
        mock.restore();
    }
});

test('Certificate.downloadIds streams the ZIP archive for the given IDs', async () => {
    const mock = mockRoutes({
        '/Marti/api/certadmin/cert/download/1,2,3': () => mockResponse(200, 'application/zip', Buffer.from('zip-bytes'))
    });

    try {
        const body = await collect(await api().Certificate.downloadIds([1, '2', 3]));

        assert.deepEqual(mock.paths, ['/Marti/api/certadmin/cert/download/1,2,3']);
        assert.equal(body.toString(), 'zip-bytes');
    } finally {
        mock.restore();
    }
});

test('Certificate.downloadIds rejects an empty ID list without a request', async () => {
    const mock = mockRoutes({});

    try {
        await assert.rejects(() => api().Certificate.downloadIds([]), /At least one ID must be provided/);
        assert.deepEqual(mock.paths, []);
    } finally {
        mock.restore();
    }
});

test('Certificate.downloadIds throws on a TAK Server error instead of streaming the error page', async () => {
    const mock = mockRoutes({
        '/Marti/api/certadmin/cert/download/1': () => mockResponse(500, 'text/plain', 'exception in downloadCertificates!')
    });

    try {
        await assert.rejects(() => api().Certificate.downloadIds([1]), (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.equal((err as { status?: number }).status, 500);
            assert.match(err.message, /downloadCertificates/);
            return true;
        });
    } finally {
        mock.restore();
    }
});
