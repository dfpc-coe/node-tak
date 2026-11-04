import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate } from '../lib/auth.js';
import { MissionSubscriberRole } from '../lib/api/mission.js';

type RequestArgs = Parameters<Client['request']>[0];

function mockResponse(statusCode: number, contentType: string, body: string): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

test('Mission.setRole sends role as a bare query param and returns void', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.setRole('mission-1', {
            clientUid: 'client-1',
            username: 'alice',
            role: MissionSubscriberRole.MISSION_OWNER
        });

        assert.equal(res, undefined);
        assert.ok(captured);
        assert.equal(captured.method, 'PUT');
        assert.equal(
            captured.path,
            '/Marti/api/missions/mission-1/role?clientUid=client-1&username=alice&role=MISSION_OWNER'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.subscriptionRoles parses a list of subscribers with roles', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/json', JSON.stringify({
            data: [{
                clientUid: 'client-1',
                username: 'alice',
                createTime: '2026-01-01T00:00:00.000Z',
                role: {
                    permissions: ['MISSION_READ', 'MISSION_WRITE'],
                    type: 'MISSION_SUBSCRIBER'
                }
            }]
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.subscriptionRoles('mission-1');

        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].username, 'alice');
        assert.equal(res.data[0].role.type, 'MISSION_SUBSCRIBER');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.unsubscribe issues a DELETE with uid query param', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.unsubscribe('mission-1', { uid: 'client-1' });

        assert.ok(captured);
        assert.equal(captured.method, 'DELETE');
        assert.equal(captured.path, '/Marti/api/missions/mission-1/subscription?uid=client-1');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.latestFeats parses each CoT individually and isolates invalid CoTs', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/xml', `
            <events>
                <event version="2.0" uid="uid-valid" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                    <point lat="1.1" lon="2.2" hae="0.0" ce="9999999.0" le="9999999.0"/>
                    <detail>
                        <contact callsign="ALPHA"/>
                    </detail>
                </event>
                <event version="2.0" uid="uid-poisoned" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                    <detail>
                        <contact callsign="BRAVO"/>
                    </detail>
                </event>
            </events>
        `);
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.latestFeats('mission-1');

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/missions/mission-1/cot');

        assert.equal(res.features.length, 1);
        assert.equal(res.features[0].id, 'uid-valid');
        assert.equal(res.features[0].properties.callsign, 'ALPHA');

        assert.equal(res.invalid.length, 1);
        assert.ok(res.invalid[0].error.length > 0);

        const event = res.invalid[0].feature as {
            _attributes?: Record<string, unknown>;
            detail?: { contact?: { _attributes?: Record<string, unknown> } };
        };

        assert.equal(event._attributes?.uid, 'uid-poisoned');
        assert.equal(event.detail?.contact?._attributes?.callsign, 'BRAVO');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.latestFeats returns empty results for an empty document', async () => {
    const originalRequest = Client.prototype.request;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/xml', '<events></events>');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.latestFeats('mission-1');

        assert.deepEqual(res, { features: [], invalid: [] });
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.changes uses the guid changes endpoint for GUID missions', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'MissionChange', nodeId: 'n', data: []
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.changes('11111111-2222-3333-4444-555555555555', { secago: 60 });

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/changes?secago=60');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.list uses the unpaged missions endpoint by default', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', data: []
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.list({ passwordProtected: true, tool: 'public' });

        assert.deepEqual(res.data, []);
        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/missions?passwordProtected=true&tool=public');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.list with paged: true uses the pagedmissions endpoint', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', data: [{ name: 'alpha', guid: '11111111-2222-3333-4444-555555555555' }]
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.list({
            paged: true,
            page: 2,
            pagesize: 25,
            sort: 'name',
            ascending: false,
            nameFilter: 'alp'
        });

        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].name, 'alpha');
        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(
            captured.path,
            '/Marti/api/pagedmissions?page=2&pagesize=25&sort=name&ascending=false&nameFilter=alp'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.list serializes keywordFilter & groupFilter as repeated params', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', data: []
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.list({
            paged: true,
            keywordFilter: ['fire', 'flood'],
            groupFilter: '__ANON__'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(
            captured.path,
            '/Marti/api/pagedmissions?keywordFilter=fire&keywordFilter=flood&groupFilter=__ANON__'
        );
    } finally {
        Client.prototype.request = originalRequest;
    }
});

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

async function collect(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

const ARCHIVE_GUID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

test('Mission.getArchive streams the ZIP for a mission name', async () => {
    const mock = mockRoutes({
        '/Marti/api/missions/Fire%20Sync/archive': () => mockResponse(200, 'application/zip', 'zip-bytes')
    });

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));
        const body = await collect(await api.Mission.getArchive('Fire Sync'));

        assert.deepEqual(mock.paths, ['/Marti/api/missions/Fire%20Sync/archive']);
        assert.equal(body.toString(), 'zip-bytes');
    } finally {
        mock.restore();
    }
});

test('Mission.getArchive resolves a GUID to the mission name before requesting the archive', async () => {
    const mock = mockRoutes({
        [`/Marti/api/missions/guid/${ARCHIVE_GUID}`]: () => mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', nodeId: 'n', data: [{ name: 'Fire Sync', guid: ARCHIVE_GUID }]
        })),
        '/Marti/api/missions/Fire%20Sync/archive': () => mockResponse(200, 'application/zip', 'zip-bytes')
    });

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));
        const body = await collect(await api.Mission.getArchive(ARCHIVE_GUID));

        assert.deepEqual(mock.paths, [
            `/Marti/api/missions/guid/${ARCHIVE_GUID}`,
            '/Marti/api/missions/Fire%20Sync/archive'
        ]);
        assert.equal(body.toString(), 'zip-bytes');
    } finally {
        mock.restore();
    }
});

test('Mission.getArchive throws on a TAK Server error instead of streaming an empty body', async () => {
    const mock = mockRoutes({
        '/Marti/api/missions/Missing/archive': () => mockResponse(404, 'text/plain', '')
    });

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await assert.rejects(() => api.Mission.getArchive('Missing'), (err: unknown) => {
            assert.equal((err as { status?: number }).status, 404);
            return true;
        });
    } finally {
        mock.restore();
    }
});

test('Mission.parent uses the name parent endpoint and unwraps the mission', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', nodeId: 'n', data: { name: 'parent-1', guid: '11111111-2222-3333-4444-555555555555' }
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const parent = await api.Mission.parent('child 1');

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.path, '/Marti/api/missions/child%201/parent');
        assert.equal(parent.name, 'parent-1');
        assert.equal(parent.description, '');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.parent resolves a GUID to a name first', async () => {
    const originalRequest = Client.prototype.request;

    const paths: string[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        paths.push(String(opts.path));

        if (paths.length === 1) {
            return mockResponse(200, 'application/json', JSON.stringify({
                version: '3', type: 'Mission', nodeId: 'n', data: [{ name: 'child-1', guid: '11111111-2222-3333-4444-555555555555' }]
            }));
        }

        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3', type: 'Mission', nodeId: 'n', data: { name: 'parent-1', guid: '22222222-2222-3333-4444-555555555555' }
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const parent = await api.Mission.parent('11111111-2222-3333-4444-555555555555');

        assert.deepEqual(paths, [
            '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555',
            '/Marti/api/missions/child-1/parent'
        ]);
        assert.equal(parent.name, 'parent-1');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.clearParent issues a DELETE on the guid parent endpoint', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const res = await api.Mission.clearParent('11111111-2222-3333-4444-555555555555');

        assert.equal(res, undefined);
        assert.ok(captured);
        assert.equal(captured.method, 'DELETE');
        assert.equal(captured.path, '/Marti/api/missions/guid/11111111-2222-3333-4444-555555555555/parent');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.update sends defaultRole alongside the current mission values', async () => {
    const originalRequest = Client.prototype.request;

    const captured: RequestArgs[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured.push(opts);
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3',
            type: 'Mission',
            data: [{
                name: 'mission-1',
                guid: '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71',
                createTime: '2024-01-01T00:00:00Z',
                description: 'desc',
                tool: 'public',
                keywords: [],
                externalData: [],
                feeds: [],
                mapLayers: [],
                inviteOnly: false,
                expiration: -1,
                uids: [],
                contents: [],
                passwordProtected: false,
                defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] },
                groups: ['__ANON__']
            }],
            nodeId: 'node'
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const mission = await api.Mission.update('mission-1', {
            defaultRole: MissionSubscriberRole.MISSION_READONLY_SUBSCRIBER
        });

        assert.equal(mission.defaultRole?.type, 'MISSION_SUBSCRIBER');
        assert.equal(captured.length, 2);
        assert.equal(captured[1].method, 'POST');

        const url = new URL(String(captured[1].path), 'https://tak.example.com');
        assert.equal(url.pathname, '/Marti/api/missions/mission-1');
        assert.equal(url.searchParams.get('defaultRole'), 'MISSION_READONLY_SUBSCRIBER');
        assert.equal(url.searchParams.get('description'), 'desc');
        assert.equal(url.searchParams.get('group'), '__ANON__');
        assert.equal(url.searchParams.get('allowDupe'), 'false');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.update omits defaultRole when it is not provided', async () => {
    const originalRequest = Client.prototype.request;

    const captured: RequestArgs[] = [];

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured.push(opts);
        return mockResponse(200, 'application/json', JSON.stringify({
            version: '3',
            type: 'Mission',
            data: [{
                name: 'mission-1',
                guid: '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71',
                createTime: '2024-01-01T00:00:00Z',
                description: 'desc',
                tool: 'public',
                keywords: [],
                externalData: [],
                feeds: [],
                mapLayers: [],
                inviteOnly: false,
                expiration: -1,
                uids: [],
                contents: [],
                passwordProtected: false,
                defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: [] }
            }],
            nodeId: 'node'
        }));
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.update('mission-1', { description: 'next' });

        const url = new URL(String(captured[1].path), 'https://tak.example.com');
        assert.equal(url.searchParams.has('defaultRole'), false);
        assert.equal(url.searchParams.get('description'), 'next');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.setPassword issues a PUT on the guid password endpoint', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.setPassword('9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', 'p%ss?w"rd', {
            token: 'mission-token'
        });

        assert.ok(captured);
        assert.equal(captured.method, 'PUT');

        const url = new URL(String(captured.path), 'https://tak.example.com');
        assert.equal(url.pathname, '/Marti/api/missions/guid/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71/password');
        assert.equal(url.searchParams.get('password'), 'p%ss?w"rd');
        assert.equal((captured.headers as Record<string, string>).MissionAuthorization, 'Bearer mission-token');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.setPassword rejects an empty password without calling TAK Server', async () => {
    const originalRequest = Client.prototype.request;

    let called = false;

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        called = true;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await assert.rejects(
            api.Mission.setPassword('mission-1', ''),
            { status: 400, message: 'Mission Password cannot be empty' }
        );

        assert.equal(called, false);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Mission.removePassword issues a DELETE on the name password endpoint', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'text/plain', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Mission.removePassword('Test Mission', undefined, 'creator-1');

        assert.ok(captured);
        assert.equal(captured.method, 'DELETE');
        assert.equal(captured.path, '/Marti/api/missions/Test%20Mission/password?creatorUid=creator-1');
    } finally {
        Client.prototype.request = originalRequest;
    }
});
