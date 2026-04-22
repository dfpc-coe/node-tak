import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { IncomingHttpHeaders } from 'node:http';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate, APIAuthPassword } from '../lib/auth.js';
import stream2buffer from '../lib/stream.js';

type RequestArgs = Parameters<Client['request']>[0];
type ErrorWithCode = Error & { code?: string };

test('Files.uploadPackage serializes multipart for certificate auth', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;

        return {
            statusCode: 200,
            headers: {
                'content-type': 'text/plain'
            },
            body: Readable.from([Buffer.from('ok')]),
            trailers: {}
        } as unknown as Dispatcher.ResponseData;
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Files.uploadPackage({
            name: 'mission.zip',
            creatorUid: 'user-1',
            hash: 'hash-123',
            keywords: ['alpha'],
            groups: ['Blue']
        }, Buffer.from('zip-bytes'));

        assert.equal(res, 'ok');
        assert.ok(captured);
        assert.equal(captured.path, '/Marti/sync/missionupload?filename=mission.zip&creatorUid=user-1&hash=hash-123&keyword=missionpackage&keyword=alpha&Groups=Blue');
        const headers = captured.headers as IncomingHttpHeaders;
        assert.equal(typeof headers['Content-Type'], 'string');
        assert.equal(typeof headers['Content-Length'], 'string');
        assert.match(headers['Content-Type'] as string, /^multipart\/form-data; boundary=----node-tak-/);
        assert.equal(Number(headers['Content-Length']) > 0, true);

        assert.ok(captured.body instanceof Readable);
        const body = await stream2buffer(captured.body);
        const multipart = body.toString('utf8');

        assert.match(multipart, /Content-Disposition: form-data; name="assetfile"; filename="mission.zip"/);
        assert.match(multipart, /Content-Type: application\/zip/);
        assert.match(multipart, /zip-bytes/);
        assert.match(multipart, /--$/m);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('APIAuthPassword surfaces transport causes during login', async () => {
    const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthPassword('alice', 'secret'));
    const originalFetch = api.auth.fetch;

    api.auth.fetch = async () => {
        const cause: ErrorWithCode = new Error('certificate has expired');
        cause.code = 'CERT_HAS_EXPIRED';

        throw new TypeError('fetch failed', { cause });
    };

    await assert.rejects(
        api.auth.init(api),
        (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.equal(err.name, 'PublicError');
            assert.match(err.message, /CERT_HAS_EXPIRED/);
            assert.match(err.message, /certificate has expired/);

            return true;
        }
    );

    api.auth.fetch = async () => {
        const cause: ErrorWithCode = new Error('connect ECONNREFUSED 127.0.0.1:8443');
        cause.code = 'ECONNREFUSED';

        throw new TypeError('fetch failed', { cause });
    };

    await assert.rejects(
        api.auth.init(api),
        (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.equal(err.name, 'PublicError');
            assert.match(err.message, /ECONNREFUSED/);
            assert.match(err.message, /connect ECONNREFUSED 127\.0\.0\.1:8443/);

            return true;
        }
    );

    api.auth.fetch = originalFetch;
});