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

const EVENTS = `<?xml version="1.0" encoding="UTF-8"?>
<events>
    <event version="2.0" uid="sensor-1" type="a-f-G" time="2026-10-26T10:00:00.000Z" start="2026-10-26T10:00:00.000Z" stale="2026-10-26T10:05:00.000Z" how="m-g">
        <point lat="39.7" lon="-104.9" hae="1600.0" ce="10.0" le="10.0"/>
        <detail><contact callsign="SEE_1"/></detail>
    </event>
    <event version="2.0" uid="sensor-2" type="a-f-G" time="2026-10-26T10:01:00.000Z" start="2026-10-26T10:01:00.000Z" stale="2026-10-26T10:06:00.000Z" how="m-g">
        <point lat="39.8" lon="-104.8" hae="1600.0" ce="10.0" le="10.0"/>
        <detail><contact callsign="SEE_2"/></detail>
    </event>
</events>`;

test('Query.saFeats builds the cot/sa request and parses every event', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(200, 'application/xml', EVENTS);
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const feats = await api.Query.saFeats({
            start: '2026-10-26T09:00:00.000Z',
            end: '2026-10-26T11:00:00.000Z',
            bbox: [-105, 39, -104, 40],
            filtered: false
        });

        assert.ok(captured);
        assert.equal(captured.method, 'GET');
        assert.equal(
            captured.path,
            '/Marti/api/cot/sa?start=2026-10-26T09%3A00%3A00.000Z&end=2026-10-26T11%3A00%3A00.000Z&left=-105&bottom=39&right=-104&top=40&isFiltered=false'
        );

        assert.equal(feats.length, 2);
        assert.equal(feats[0].id, 'sensor-1');
        assert.equal(feats[0].properties.callsign, 'SEE_1');
        assert.equal(feats[0].properties.time, '2026-10-26T10:00:00.000Z');
        assert.deepEqual(feats[0].geometry, { type: 'Point', coordinates: [-104.9, 39.7, 1600] });
        assert.equal(feats[1].id, 'sensor-2');
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Query.sa resolves secago to an explicit window and rejects what TAK Server would refuse', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(404, 'application/xml', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        await api.Query.sa({ end: '2026-10-26T12:00:00.000Z', secago: '7200' });
        assert.equal(captured?.path, '/Marti/api/cot/sa?start=2026-10-26T10%3A00%3A00.000Z&end=2026-10-26T12%3A00%3A00.000Z');

        const before = Date.now();
        await api.Query.sa();
        const params = new URL(String(captured?.path), 'https://tak.example.com').searchParams;
        const start = Date.parse(String(params.get('start')));
        const end = Date.parse(String(params.get('end')));
        assert.equal(end - start, 3600 * 1000);
        assert.ok(end >= before && end <= Date.now());

        await assert.rejects(api.Query.sa({ start: '2026-10-26T13:00:00.000Z', end: '2026-10-26T12:00:00.000Z' }), /start must be before end/);
        await assert.rejects(api.Query.sa({ start: '2026-10-25T11:59:59.000Z', end: '2026-10-26T12:00:00.000Z' }), /24 hours or less/);
        await assert.rejects(api.Query.sa({ start: 'yesterday' }), /ISO 8601/);
        await assert.rejects(api.Query.sa({ secago: 0 }), /positive integer/);

        Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
            return mockResponse(500, 'text/html', '<html>boom</html>');
        };
        await assert.rejects(api.Query.saFeats({ secago: 60 }), /failed: 500/);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Query.saFeats omits optional params and returns [] for an empty 404 body', async () => {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return mockResponse(404, 'application/xml', '');
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        const feats = await api.Query.saFeats({
            start: '2026-10-26T09:00:00.000Z',
            end: '2026-10-26T11:00:00.000Z',
        });

        assert.ok(captured);
        assert.equal(captured.path, '/Marti/api/cot/sa?start=2026-10-26T09%3A00%3A00.000Z&end=2026-10-26T11%3A00%3A00.000Z');
        assert.deepEqual(feats, []);
    } finally {
        Client.prototype.request = originalRequest;
    }
});

test('Query.historyFeats returns [] for an empty body and parses a single event', async () => {
    const originalRequest = Client.prototype.request;

    let body = '';

    Client.prototype.request = async function(): Promise<Dispatcher.ResponseData> {
        return mockResponse(200, 'application/xml', body);
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));

        assert.deepEqual(await api.Query.historyFeats('sensor-1', { secago: '3600' }), []);

        body = `<events>
            <event version="2.0" uid="sensor-1" type="a-f-G" time="2026-10-26T10:00:00.000Z" start="2026-10-26T10:00:00.000Z" stale="2026-10-26T10:05:00.000Z" how="m-g">
                <point lat="39.7" lon="-104.9" hae="1600.0" ce="10.0" le="10.0"/>
                <detail><contact callsign="SEE_1"/></detail>
            </event>
        </events>`;

        const feats = await api.Query.historyFeats('sensor-1', { secago: '3600' });
        assert.equal(feats.length, 1);
        assert.equal(feats[0].id, 'sensor-1');
    } finally {
        Client.prototype.request = originalRequest;
    }
});
