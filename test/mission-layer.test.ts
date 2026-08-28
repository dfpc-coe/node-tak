import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate } from '../lib/auth.js';

type RequestArgs = Parameters<Client['request']>[0];

function mockResponse(statusCode: number, contentType: string, body: string): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

test('MissionLayer.attachUids files UIDs under a layer via the contents paths body', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.MissionLayer.attachUids('mission-1', 'layer-1', {
            uids: ['uid-1', 'uid-2'],
            creatorUid: 'alice'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'PUT');
        assert.equal(captured.path, '/Marti/api/missions/mission-1/contents?creatorUid=alice');
        assert.deepEqual(JSON.parse(String(captured.body)), {
            paths: {
                'layer-1': [{ uids: ['uid-1', 'uid-2'] }]
            }
        });
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.attachUids uses the guid contents endpoint for GUID missions', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.MissionLayer.attachUids('11111111-2222-3333-4444-555555555555', 'layer-1', {
            uids: ['uid-1'],
            creatorUid: 'alice'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'PUT');
        assert.equal(
            captured.path,
            '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/contents?creatorUid=alice'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.setParent re-parents layers via query params', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.MissionLayer.setParent('mission-1', {
            layerUids: ['uid-1', 'uid-2'],
            parentUid: 'layer-2',
            creatorUid: 'alice'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'PUT');
        assert.equal(
            captured.path,
            '/Marti/api/missions/mission-1/layers/parent?layerUid=uid-1&layerUid=uid-2&parentUid=layer-2&creatorUid=alice'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.setParent omits parentUid to move a layer to the mission root', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.MissionLayer.setParent('11111111-2222-3333-4444-555555555555', {
            layerUids: ['uid-1'],
            creatorUid: 'alice'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'PUT');
        assert.equal(
            captured.path,
            '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/layers/parent?layerUid=uid-1&creatorUid=alice'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.list uses the guid layers endpoint for GUID missions', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'MissionLayer', nodeId: 'n',
            data: [{ uid: 'layer-1', name: 'Layer 1', type: 'UID' }]
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.MissionLayer.list('11111111-2222-3333-4444-555555555555');

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/layers');
        assert.deepEqual(res.data[0].uids, []);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.get fetches a single layer by uid', async () => {
    const originalRequest = Client.prototype.request;

    const paths: string[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        paths.push(String(opts.path));
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'MissionLayer', nodeId: 'n',
            data: { uid: 'layer-1', name: 'Layer 1', type: 'UID' }
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const byGuid = await api.MissionLayer.get('11111111-2222-3333-4444-555555555555', 'layer-1');
        const byName = await api.MissionLayer.get('Mission 1', 'layer-1');

        assert.deepEqual(paths, [
            '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/layers/layer-1',
            '/Marti/api/missions/Mission%201/layers/layer-1'
        ]);
        assert.equal(byGuid.data.uid, 'layer-1');
        assert.deepEqual(byGuid.data.uids, []);
        assert.equal(byName.data.uid, 'layer-1');
    } finally {
        Client.prototype.request = originalRequest;
    }
});
