import TAK, { CoT } from '../index.js';
import test from 'tape';

test('Ensure Export', (t) => {
    t.ok(TAK);
    t.ok(CoT);
    t.end();
});

