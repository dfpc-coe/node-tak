import test from 'node:test';
import assert from 'node:assert/strict';
import { Queue } from '../lib/utils/queue.js';

test('Queue - push/pop FIFO order', () => {
    const q = new Queue<number>(4);
    q.push(1);
    q.push(2);
    q.push(3);
    assert.equal(q.pop(), 1);
    assert.equal(q.pop(), 2);
    assert.equal(q.pop(), 3);
});

test('Queue - capacity enforced', () => {
    const q = new Queue<number>(2);
    assert.equal(q.push(1), true);
    assert.equal(q.push(2), true);
    assert.equal(q.isFull, true);
    assert.equal(q.push(3), false);
    assert.equal(q.length, 2);
});

test('Queue - pop from empty', () => {
    const q = new Queue<number>(2);
    assert.equal(q.pop(), undefined);
    assert.equal(q.length, 0);
});

test('Queue - ring buffer wraparound', () => {
    const q = new Queue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    // Pop two — head advances past midpoint
    assert.equal(q.pop(), 1);
    assert.equal(q.pop(), 2);
    // Push two more — tail wraps around
    q.push(4);
    q.push(5);
    // Remaining items come out in FIFO order
    assert.equal(q.pop(), 3);
    assert.equal(q.pop(), 4);
    assert.equal(q.pop(), 5);
    assert.equal(q.length, 0);
});
