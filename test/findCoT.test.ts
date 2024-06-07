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
        discard: '<event></event>'
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
        discard: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>'
    });
    t.end();
});

