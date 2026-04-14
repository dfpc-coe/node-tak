import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import TAK, { CoT } from '../index.js';
import { CoTParser } from '@tak-ps/node-cot';

function createTAK(opts: { writeQueueSize?: number; socketBatchSize?: number } = {}): TAK {
    return new TAK(new URL('ssl://localhost:8089'), { cert: 'test', key: 'test' }, opts);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFakeSocket(opts: { write?: (...args: unknown[]) => boolean } = {}): any {
    return Object.assign(new EventEmitter(), {
        write: opts.write ?? (() => true),
        destroyed: false,
        writable: true,
        writableNeedDrain: false,
        writableLength: 0,
        destroy() { this.destroyed = true; },
        setNoDelay: () => {},
    });
}

test('write - resolves when all CoTs are queued and sent', async () => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    const cots = [CoT.ping(), CoT.ping()];
    await tak.write(cots);

    assert.equal(tak.queue.length, 0, 'queue empty after write + pull');
});

test('write - returns early when destroyed', async () => {
    const tak = createTAK();
    tak.destroyed = true;
    await tak.write([CoT.ping()]);
    assert.equal(tak.queue.length, 0, 'nothing queued');
});

test('write - multiple concurrent writes', async () => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    const order: number[] = [];
    const p1 = tak.write([CoT.ping()]).then(() => order.push(1));
    const p2 = tak.write([CoT.ping()]).then(() => order.push(2));
    await Promise.all([p1, p2]);

    assert.deepEqual(order, [1, 2], 'writes resolve in order');
    assert.equal(tak.queue.length, 0, 'queue drained');
});

test('pull - batches CoTs into single socket.write call', async () => {
    const tak = createTAK({ socketBatchSize: 64 });
    const writeCalls: string[] = [];
    tak.client = createFakeSocket({
        write(...args: unknown[]) {
            writeCalls.push(args[0] as string);
            return true;
        },
    });

    await tak.write([CoT.ping(), CoT.ping()]);

    assert.equal(writeCalls.length, 1, 'socket.write called once for batch');
    assert.ok(writeCalls[0].includes('<event'), 'batch contains XML events');
    assert.equal(tak.queue.length, 0, 'queue drained');
});

test('pull - respects backpressure and resumes on process()', async () => {
    const tak = createTAK({ socketBatchSize: 1 });
    let callCount = 0;
    const socket = createFakeSocket({
        write() {
            callCount++;
            if (callCount === 1) {
                socket.writableNeedDrain = true;
                return false;
            }
            return true;
        },
    });
    tak.client = socket;

    // Both CoTs get queued immediately, pull() sends 1 and hits backpressure
    await tak.write([CoT.ping(), CoT.ping()]);

    assert.equal(callCount, 1, 'one write before backpressure');
    assert.equal(tak.queue.length, 1, 'one item still in queue');

    // Simulate backpressure clearing (equivalent to drain event)
    socket.writableNeedDrain = false;
    tak.process();

    assert.equal(callCount, 2, 'second write after backpressure cleared');
    assert.equal(tak.queue.length, 0, 'queue drained');
});

test('pull - error in socket.write triggers destroy + error event', async () => {
    const tak = createTAK();
    tak.client = createFakeSocket({
        write() { throw new Error('write failed'); },
    });

    let errorFired = false;
    let errorMsg = '';
    tak.on('error', (err) => { errorFired = true; errorMsg = err.message; });

    // write() enqueues, pull() throws internally, catches → destroy + emit error
    // write() sees destroyed=true on next check and returns
    await tak.write([CoT.ping()]);

    assert.equal(tak.destroyed, true, 'destroyed after write error');
    assert.ok(errorFired, 'error event fired');
    assert.equal(errorMsg, 'write failed', 'error message matches');
});

test('pull - noop when already writing', () => {
    const tak = createTAK();
    tak.client = createFakeSocket();
    tak.writing = true;

    tak.queue.push('<event/>');

    // pull() should return immediately since writing=true
    tak.process();

    assert.equal(tak.queue.length, 1, 'queue unchanged');
});

test('flush - resolves immediately when nothing queued', async () => {
    const tak = createTAK();
    await tak.flush();
    assert.ok(true, 'flush resolved immediately');
});

test('flush - rejects when destroyed mid-flush', async () => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    // Simulate an in-progress write so flush enters the wait path
    tak.writing = true;
    tak.queue.push('<event/>');

    const p = tak.flush();
    tak.destroy();

    try {
        await p;
        assert.fail('should have rejected');
    } catch (err) {
        assert.ok(err instanceof Error, 'error is an Error');
        assert.ok((err as Error).message.includes('destroyed'), 'error mentions destroyed');
    }
});

test('flush - waits for queue to drain via process()', async () => {
    const tak = createTAK({ socketBatchSize: 1 });
    let callCount = 0;
    const socket = createFakeSocket({
        write() {
            callCount++;
            if (callCount === 1) {
                socket.writableNeedDrain = true;
                return false;
            }
            return true;
        },
    });
    tak.client = socket;

    await tak.write([CoT.ping(), CoT.ping()]);
    assert.equal(tak.queue.length, 1, 'one item in queue after backpressure');

    // Clear backpressure and drain
    socket.writableNeedDrain = false;
    const flushP = tak.flush();
    tak.process();
    await flushP;

    assert.equal(tak.queue.length, 0, 'queue empty after flush');
    assert.equal(callCount, 2, 'both items sent');
});

test('write - yields when queue is full and resumes after destroy', async () => {
    // writeQueueSize=4 → queue capacity = 4
    const tak = createTAK({ writeQueueSize: 4 });

    // No client, so pull() is a no-op → queue fills up and write() yields
    let writeResolved = false;
    const p = tak.write([CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping()])
        .then(() => { writeResolved = true; });
    await new Promise(r => setImmediate(r));

    assert.equal(tak.queue.length, 4, 'queue at capacity');
    assert.equal(writeResolved, false, 'write blocked waiting for space');

    // Destroy unblocks write (destroyed check in loop)
    tak.destroy();
    await p;
    assert.ok(writeResolved, 'write resolved after destroy');
});

test('write - resumes after queue drains', async () => {
    // writeQueueSize=8 → queue capacity = 8, socketBatchSize=4
    const tak = createTAK({ writeQueueSize: 8, socketBatchSize: 4 });
    let callCount = 0;
    const socket = createFakeSocket({
        write() {
            callCount++;
            return true;
        },
    });
    tak.client = socket;

    // Write 10 items — queue capacity is 8, write() must yield once queue fills
    await tak.write([
        CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(),
        CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(),
    ]);

    assert.equal(tak.queue.length, 0, 'all drained');
    assert.ok(callCount >= 2, 'multiple socket.write calls needed');
});

test('write - caller can safely modify array after write returns', async () => {
    const tak = createTAK();
    const writeCalls: string[] = [];
    tak.client = createFakeSocket({
        write(...args: unknown[]) {
            writeCalls.push(args[0] as string);
            return true;
        },
    });

    const cots = [CoT.ping()];
    await tak.write(cots);

    // Modify the array after write — should not affect what was sent
    cots.length = 0;

    assert.equal(writeCalls.length, 1, 'socket.write was called');
    assert.ok(writeCalls[0].includes('<event'), 'CoT was sent before array was cleared');
    assert.equal(tak.queue.length, 0, 'queue empty');
});

test('write - stripFlow replaces existing flow tags in outbound XML', async () => {
    const tak = createTAK();
    const writeCalls: string[] = [];
    tak.client = createFakeSocket({
        write(...args: unknown[]) {
            writeCalls.push(args[0] as string);
            return true;
        },
    });

    const cot = await CoTParser.from_geojson({
        id: '123',
        type: 'Feature',
        path: '/',
        properties: {
            type: 'a-f-G',
            how: 'm-g',
            callsign: 'BasicTest',
            center: [1.1, 2.2, 0],
            time: '2023-08-04T15:17:43.649Z',
            start: '2023-08-04T15:17:43.649Z',
            stale: '2023-08-04T15:17:43.649Z',
            flow: {
                'TAK-Server-test': '2026-03-08T04:48:00Z'
            },
            metadata: {}
        },
        geometry: {
            type: 'Point',
            coordinates: [1.1, 2.2, 0]
        }
    });

    await tak.write([cot], { stripFlow: true });

    assert.equal(writeCalls.length, 1, 'socket.write was called');
    assert.ok(!writeCalls[0].includes('TAK-Server-test='), 'server flow tag removed from outbound XML');
    assert.ok(writeCalls[0].includes('NodeCoT-'), 'node-cot flow tag added to outbound XML');

    const outbound = CoTParser.from_xml(writeCalls[0]);
    const outboundFlow = outbound.raw.event.detail?.['_flow-tags_'];

    assert.ok(outboundFlow, 'outbound CoT contains flow tags');
    assert.equal(Object.keys(outboundFlow || {}).length, 1, 'outbound CoT flow object is reset to one initial tag');
    assert.ok(!outboundFlow?.['TAK-Server-test'], 'outbound CoT flow object clears prior TAK Server tags');

    const feat = await CoTParser.to_geojson(cot);
    assert.equal(feat.properties.flow?.['TAK-Server-test'], '2026-03-08T04:48:00Z', 'original CoT remains unchanged');
});

test('destroy - sets destroyed and clears ping interval', () => {
    const tak = createTAK();
    tak.pingInterval = setInterval(() => {}, 60000);

    tak.destroy();

    assert.equal(tak.destroyed, true, 'destroyed is true');
    assert.equal(tak.pingInterval, undefined, 'pingInterval cleared');
});
