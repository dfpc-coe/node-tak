import test from 'tape';
import { Queue } from '../lib/utils/queue.js';

test('Queue - push/pop FIFO order', (t) => {
    const q = new Queue<number>(4);
    q.push(1);
    q.push(2);
    q.push(3);
    t.equals(q.pop(), 1);
    t.equals(q.pop(), 2);
    t.equals(q.pop(), 3);
    t.end();
});

test('Queue - capacity enforced', (t) => {
    const q = new Queue<number>(2);
    t.equals(q.push(1), true);
    t.equals(q.push(2), true);
    t.equals(q.isFull, true);
    t.equals(q.push(3), false);
    t.equals(q.length, 2);
    t.end();
});

test('Queue - pop from empty', (t) => {
    const q = new Queue<number>(2);
    t.equals(q.pop(), undefined);
    t.equals(q.length, 0);
    t.end();
});

test('Queue - ring buffer wraparound', (t) => {
    const q = new Queue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    // Pop two — head advances past midpoint
    t.equals(q.pop(), 1);
    t.equals(q.pop(), 2);
    // Push two more — tail wraps around
    q.push(4);
    q.push(5);
    // Remaining items come out in FIFO order
    t.equals(q.pop(), 3);
    t.equals(q.pop(), 4);
    t.equals(q.pop(), 5);
    t.equals(q.length, 0);
    t.end();
});
