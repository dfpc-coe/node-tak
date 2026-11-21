import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import { Value } from '@sinclair/typebox/value';
import TAKAPI from '../lib/api.js';
import { TAKList_MissionLayer } from '../lib/api/mission-layer.js';
import { APIAuthCertificate } from '../lib/auth.js';

type RequestArgs = Parameters<Client['request']>[0];

// oxlint-disable-next-line typescript/unbound-method
const originalRequest = Client.prototype.request;

function mockResponse(statusCode: number, contentType: string, body: string): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

test('MissionLayer.attachUids files UIDs under a layer via the contents paths body', async () => {
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
        assert.deepEqual(JSON.parse(captured.body as string), {
            paths: {
                'layer-1': [{ uids: ['uid-1', 'uid-2'] }]
            }
        });
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('MissionLayer.attachUids uses the guid contents endpoint for GUID missions', async () => {
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
    const paths: string[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        paths.push(opts.path);
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

test('MissionLayer schema accepts UIDs without a location (e.g. routes)', () => {
    const res = {
        version: '3',
        type: 'MissionLayer',
        nodeId: 'node-1',
        data: [{
            name: 'Routes',
            type: 'UID',
            uid: 'layer-1',
            uids: [{
                data: 'route-1',
                timestamp: '2026-11-11T18:31:52.328Z',
                creatorUid: 'alice',
                details: {
                    type: 'b-m-r',
                    callsign: 'Schultz Tank To Inner Basin',
                    color: '-16711681'
                }
            }, {
                data: 'marker-1',
                timestamp: '2026-11-11T18:31:31.905Z',
                creatorUid: 'alice',
                details: {
                    type: 'a-n-G',
                    callsign: 'M4',
                    iconsetPath: 'ad78aafb-83a6-4c07-b2b9-a897a8b6a38f/NumPins/04 Pin Invert.png',
                    location: { lat: 35.33, lon: -111.69 }
                }
            }]
        }]
    };

    assert.equal(Value.Check(TAKList_MissionLayer, res), true, JSON.stringify([...Value.Errors(TAKList_MissionLayer, res)]));
});

test('MissionLayer schema accepts hydrated contents and maplayers', () => {
    const res = {
        version: '3',
        type: 'MissionLayer',
        nodeId: 'node-1',
        data: [{
            name: 'Models',
            type: 'UID',
            uid: 'layer-1',
            uids: [{
                data: 'model-1',
                timestamp: '2026-11-11T18:31:52.328Z',
                details: {
                    type: 'u-d-v-m',
                    callsign: 'Model',
                    title: 'Model',
                    name: 'Truck',
                    category: 'Vehicles',
                    attachments: ['abc123'],
                    location: { lat: 35.33, lon: -111.69 }
                }
            }]
        }, {
            name: 'Files',
            type: 'CONTENTS',
            uid: 'layer-2',
            contents: [{
                data: {
                    filename: 'plan.pdf',
                    keywords: [],
                    mimeType: 'application/pdf',
                    name: 'plan.pdf',
                    submissionTime: '2026-11-11T18:31:52.328Z',
                    submitter: 'alice',
                    uid: 'file-1',
                    hash: 'abc123',
                    size: 1024,
                    creatorUid: 'alice',
                    tool: 'public',
                    latitude: 35.33,
                    longitude: -111.69,
                    expiration: -1
                },
                timestamp: '2026-11-11T18:31:52.328Z',
                creatorUid: 'alice'
            }]
        }, {
            name: 'Maps',
            type: 'MAPLAYER',
            uid: 'layer-3',
            maplayers: [{
                data: {
                    uid: 'map-1',
                    name: 'Imagery',
                    type: 'XYZ',
                    url: 'https://example.com/{z}/{x}/{y}.png',
                    creatorUid: 'alice',
                    createTime: '2026-11-11T18:31:52.328Z',
                    modifiedTime: '2026-11-11T18:31:52.328Z',
                    enabled: true,
                    defaultLayer: false,
                    ignoreErrors: false,
                    invertYCoordinate: false,
                    minZoom: 0,
                    maxZoom: 18,
                    opacity: 100,
                    path: '/Maps',
                    after: ''
                }
            }]
        }]
    };

    assert.equal(Value.Check(TAKList_MissionLayer, res), true, JSON.stringify([...Value.Errors(TAKList_MissionLayer, res)]));
});
