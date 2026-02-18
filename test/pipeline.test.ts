import test from 'tape';
import { EventEmitter } from 'node:events';
import TAK, { CoT } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

test('write - resolves when all CoTs are queued and sent', async (t) => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    const cots = [CoT.ping(), CoT.ping()];
    await tak.write(cots);

    t.equals(tak.queue.length, 0, 'queue empty after write + pull');
    t.end();
});

test('write - returns early when destroyed', async (t) => {
    const tak = createTAK();
    tak.destroyed = true;
    await tak.write([CoT.ping()]);
    t.equals(tak.queue.length, 0, 'nothing queued');
    t.end();
});

test('write - multiple concurrent writes', async (t) => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    const order: number[] = [];
    const p1 = tak.write([CoT.ping()]).then(() => order.push(1));
    const p2 = tak.write([CoT.ping()]).then(() => order.push(2));
    await Promise.all([p1, p2]);

    t.deepEquals(order, [1, 2], 'writes resolve in order');
    t.equals(tak.queue.length, 0, 'queue drained');
    t.end();
});

test('pull - batches CoTs into single socket.write call', async (t) => {
    const tak = createTAK({ socketBatchSize: 64 });
    const writeCalls: string[] = [];
    tak.client = createFakeSocket({
        write(...args: unknown[]) {
            writeCalls.push(args[0] as string);
            return true;
        },
    });

    await tak.write([CoT.ping(), CoT.ping()]);

    t.equals(writeCalls.length, 1, 'socket.write called once for batch');
    t.ok(writeCalls[0].includes('<event'), 'batch contains XML events');
    t.equals(tak.queue.length, 0, 'queue drained');
    t.end();
});

test('pull - respects backpressure and resumes on process()', async (t) => {
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

    t.equals(callCount, 1, 'one write before backpressure');
    t.equals(tak.queue.length, 1, 'one item still in queue');

    // Simulate backpressure clearing (equivalent to drain event)
    socket.writableNeedDrain = false;
    tak.process();

    t.equals(callCount, 2, 'second write after backpressure cleared');
    t.equals(tak.queue.length, 0, 'queue drained');
    t.end();
});

test('pull - error in socket.write triggers destroy + error event', async (t) => {
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

    t.equals(tak.destroyed, true, 'destroyed after write error');
    t.ok(errorFired, 'error event fired');
    t.equals(errorMsg, 'write failed', 'error message matches');
    t.end();
});

test('pull - noop when already writing', (t) => {
    const tak = createTAK();
    tak.client = createFakeSocket();
    tak.writing = true;

    tak.queue.push('<event/>');

    // pull() should return immediately since writing=true
    tak.process();

    t.equals(tak.queue.length, 1, 'queue unchanged');
    t.end();
});

test('flush - resolves immediately when nothing queued', async (t) => {
    const tak = createTAK();
    await tak.flush();
    t.pass('flush resolved immediately');
    t.end();
});

test('flush - rejects when destroyed mid-flush', async (t) => {
    const tak = createTAK();
    tak.client = createFakeSocket();

    // Simulate an in-progress write so flush enters the wait path
    tak.writing = true;
    tak.queue.push('<event/>');

    const p = tak.flush();
    tak.destroy();

    try {
        await p;
        t.fail('should have rejected');
    } catch (err) {
        t.ok(err instanceof Error, 'error is an Error');
        t.ok((err as Error).message.includes('destroyed'), 'error mentions destroyed');
    }
    t.end();
});

test('flush - waits for queue to drain via process()', async (t) => {
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
    t.equals(tak.queue.length, 1, 'one item in queue after backpressure');

    // Clear backpressure and drain
    socket.writableNeedDrain = false;
    const flushP = tak.flush();
    tak.process();
    await flushP;

    t.equals(tak.queue.length, 0, 'queue empty after flush');
    t.equals(callCount, 2, 'both items sent');
    t.end();
});

test('write - yields when queue is full and resumes after destroy', async (t) => {
    // writeQueueSize=4 → queue capacity = 4
    const tak = createTAK({ writeQueueSize: 4 });

    // No client, so pull() is a no-op → queue fills up and write() yields
    let writeResolved = false;
    const p = tak.write([CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping(), CoT.ping()])
        .then(() => { writeResolved = true; });
    await new Promise(r => setImmediate(r));

    t.equals(tak.queue.length, 4, 'queue at capacity');
    t.equals(writeResolved, false, 'write blocked waiting for space');

    // Destroy unblocks write (destroyed check in loop)
    tak.destroy();
    await p;
    t.ok(writeResolved, 'write resolved after destroy');
    t.end();
});

test('write - resumes after queue drains', async (t) => {
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

    t.equals(tak.queue.length, 0, 'all drained');
    t.ok(callCount >= 2, 'multiple socket.write calls needed');
    t.end();
});

test('write - caller can safely modify array after write returns', async (t) => {
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

    t.equals(writeCalls.length, 1, 'socket.write was called');
    t.ok(writeCalls[0].includes('<event'), 'CoT was sent before array was cleared');
    t.equals(tak.queue.length, 0, 'queue empty');
    t.end();
});

test('destroy - sets destroyed and clears ping interval', (t) => {
    const tak = createTAK();
    tak.pingInterval = setInterval(() => {}, 60000);

    tak.destroy();

    t.equals(tak.destroyed, true, 'destroyed is true');
    t.equals(tak.pingInterval, undefined, 'pingInterval cleared');
    t.end();
});
