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
