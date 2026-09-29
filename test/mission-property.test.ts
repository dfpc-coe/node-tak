import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate } from '../lib/auth.js';

type RequestArgs = Parameters<Client['request']>[0];

const GUID = '9ba05e1d-970f-49e1-a153-7216fecf5279';

function mockResponse(statusCode: number, contentType: string, body: string): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

async function capture(
    response: string,
    fn: (api: TAKAPI) => Promise<unknown>
): Promise<{ requests: RequestArgs[], result: unknown }> {
    const originalRequest = Client.prototype.request;
    const requests: RequestArgs[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        requests.push(opts);
        return mockResponse(200, response ? 'application/json' : 'text/plain', response);
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));
        const result = await fn(api);
        return { requests, result };
    } finally {
        Client.prototype.request = originalRequest;
    }
}

const ITEM = JSON.stringify({ version: '3', type: 'com.bbn.marti.sync.model.MissionProperty', data: { key: 'test.hello', value: 'world' } });
const LIST = JSON.stringify({ version: '3', type: 'com.bbn.marti.sync.model.MissionProperty', data: [{ key: 'test.hello', value: 'world' }] });

test('MissionProperty.list uses the guid properties endpoint with a prefix filter', async () => {
    const { requests, result } = await capture(LIST, (api) => api.MissionProperty.list(GUID, { prefix: 'test.' }));

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].path, `/Marti/api/missions/guid/${GUID}/properties?prefix=test.`);
    assert.deepEqual((result as { data: unknown }).data, [{ key: 'test.hello', value: 'world' }]);
});

test('MissionProperty.get encodes the key in the path', async () => {
    const { requests } = await capture(ITEM, (api) => api.MissionProperty.get(GUID, 'a b'));

    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].path, `/Marti/api/missions/guid/${GUID}/properties/a%20b`);
});

test('MissionProperty.set PUTs key/value with creatorUid as a query param', async () => {
    const { requests } = await capture(ITEM, (api) => api.MissionProperty.set(GUID, {
        key: 'test.hello',
        value: 'world',
        creatorUid: 'alice'
    }));

    assert.equal(requests[0].method, 'PUT');
    assert.equal(requests[0].path, `/Marti/api/missions/guid/${GUID}/properties?creatorUid=alice`);
    assert.deepEqual(JSON.parse(String(requests[0].body)), { key: 'test.hello', value: 'world' });
});

test('MissionProperty.delete removes a single key', async () => {
    const { requests } = await capture('', (api) => api.MissionProperty.delete(GUID, 'test.hello', 'alice'));

    assert.equal(requests[0].method, 'DELETE');
    assert.equal(requests[0].path, `/Marti/api/missions/guid/${GUID}/properties/test.hello?creatorUid=alice`);
});

test('MissionProperty.deleteAll removes every key', async () => {
    const { requests } = await capture('', (api) => api.MissionProperty.deleteAll(GUID, 'alice'));

    assert.equal(requests[0].method, 'DELETE');
    assert.equal(requests[0].path, `/Marti/api/missions/guid/${GUID}/properties?creatorUid=alice`);
});

test('MissionProperty resolves a mission name to its GUID first', async () => {
    const MISSION = JSON.stringify({ version: '3', type: 'Mission', data: [{ name: 'kv-test', guid: GUID }] });
    const { requests } = await capture(MISSION, (api) => api.MissionProperty.list('kv-test'));

    assert.equal(requests.length, 2);
    assert.equal(requests[0].path, '/Marti/api/missions/kv-test');
    assert.equal(requests[1].path, `/Marti/api/missions/guid/${GUID}/properties`);
});
