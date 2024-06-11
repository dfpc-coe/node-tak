import TAK from '../index.js';
import test from 'tape';

test('findCoT - Unfinished', (t) => {
    const res = TAK.findCoT('<event ><detail>');
    t.equals(res, null);
    t.end();
});

test('findCoT - Basic', (t) => {
    const res = TAK.findCoT('<event></event>');
    t.deepEquals(res, {
        event: '<event></event>',
        remainder: '',
    });
    t.end();
});

test('findCoT - New Lines', (t) => {
    const res = TAK.findCoT(`
<event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event>`);
    t.deepEquals(res, {
        event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
        remainder: '',
    });
    t.end();
});

test('findCoT - New Lines - Non-Greedy', (t) => {
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
    t.deepEquals(res, {
        event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
        remainder: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
    });
    t.end();
});

test('findCoT - bad preceding data', (t) => {
    const res = TAK.findCoT(`
<fake/>
<event><detail remarks="I am remarks"/>
</event>
`);
    t.deepEquals(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n',
    });
    t.end();
});

test('findCoT - bad post data', (t) => {
    const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
`);
    t.deepEquals(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n<fake/>\n',
    });
    t.end();
});

test('findCoT - mixed', (t) => {
    const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
<event><detail remarks="I am remarks"/></event>`);
    t.deepEquals(res, {
        event: '<event><detail remarks="I am remarks"/>\n</event>',
        remainder: '\n<fake/>\n<event><detail remarks="I am remarks"/></event>',
    });
    t.end();
});
