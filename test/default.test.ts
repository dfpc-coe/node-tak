import TAK, { CoT } from '../index.js';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Ensure Export', () => {
    assert.ok(TAK);
    assert.ok(CoT);
});

