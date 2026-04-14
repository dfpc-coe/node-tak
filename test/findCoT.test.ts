import TAK from '../index.js';
import test from 'node:test';
import assert from 'node:assert/strict';

test('findCoT - Unfinished', () => {
    const res = TAK.findCoT('<event ><detail>');
    assert.equal(res, null);
});

test('findCoT - Basic', () => {
    const res = TAK.findCoT('<event></event>');
    assert.deepEqual(res, {
        event: '<event></event>',
        remainder: '',
    });
});

test('findCoT - New Lines', () => {
    const res = TAK.findCoT(`
<event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event>`);
    assert.deepEqual(res, {
        event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
        remainder: '',
    });
});

test('findCoT - New Lines - Non-Greedy', () => {
    const res = TAK.findCoT(`
<event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event><event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event>`);
    assert.deepEqual(res, {
        event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
        remainder: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
    });
});

test('findCoT - bad preceding data', () => {
    const res = TAK.findCoT(`
<fake/>
<event><detail remarks="I am remarks"/>
</event>
`);
    assert.deepEqual(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n',
    });
});

test('findCoT - bad post data', () => {
    const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
`);
    assert.deepEqual(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n<fake/>\n',
    });
});

test('findCoT - mixed', () => {
    const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
<event><detail remarks="I am remarks"/></event>`);
    assert.deepEqual(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n<fake/>\n<event><detail remarks="I am remarks"/></event>',
    });
});
