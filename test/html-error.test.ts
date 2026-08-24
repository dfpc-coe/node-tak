import test from 'node:test';
import assert from 'node:assert/strict';
import Err from '@openaddresses/batch-error';
import {
    TAKServerError,
    isHTML,
    parseHTMLError,
    summarizeHTMLError,
    formatHTMLError,
} from '../lib/utils/html-error.js';

const TOMCAT = `<!doctype html><html lang="en"><head><title>HTTP Status 500 &ndash; Internal Server Error</title><style type="text/css">body {font-family:Tahoma,Arial,sans-serif;} h1, h2, h3, b {color:white;background-color:#525D76;} h1 {font-size:22px;} h2 {font-size:16px;} h3 {font-size:14px;} p {font-size:12px;} a {color:black;} .line {height:1px;background-color:#525D76;border:none;}</style></head><body><h1>HTTP Status 500 &ndash; Internal Server Error</h1><hr class="line" /><p><b>Type</b> Exception Report</p><p><b>Message</b> Exception performing TAK Server authentication</p><p><b>Description</b> The server encountered an unexpected condition that prevented it from fulfilling the request.</p><p><b>Exception</b></p><pre>org.springframework.security.authentication.BadCredentialsException: Exception performing TAK Server authentication
\tcom.bbn.marti.util.spring.TakAuthenticationProvider.authenticateCore(TakAuthenticationProvider.java:190)
\tcom.bbn.marti.util.spring.TakAuthenticationProvider.authenticate(TakAuthenticationProvider.java:244)
\torg.springframework.security.authentication.ProviderManager.authenticate(ProviderManager.java:181)
</pre><p><b>Note</b> The full stack trace of the root cause is available in the server logs.</p><hr class="line" /><h3>Apache Tomcat/9.0.86</h3></body></html>`;

test('html-error: isHTML', () => {
    assert.equal(isHTML(TOMCAT), true);
    assert.equal(isHTML('  <html><body>x</body></html>'), true);
    assert.equal(isHTML('<h1>HTTP Status 404 – Not Found</h1>'), true);
    assert.equal(isHTML('{"message":"nope"}'), false);
    assert.equal(isHTML('Plain text failure'), false);
    assert.equal(isHTML(null), false);
    assert.equal(isHTML({}), false);
});

test('html-error: entities are decoded', () => {
    const parsed = parseHTMLError('<html><body><p><b>Message</b> a &ndash; b &amp; &lt;c&gt; &#39;d&#39; &#x41;</p></body></html>');
    assert.ok(parsed);
    assert.equal(parsed.fields.Message, 'a – b & <c> \'d\' A');
});

test('html-error: malformed HTML falls back to visible text', () => {
    const parsed = parseHTMLError('<html><head><style>b {x:y}</style></head><body><p>Bad Gateway<br>upstream unavailable</body></html>');
    assert.ok(parsed);
    assert.equal(parsed.title, undefined);
    assert.equal(parsed.text, 'Bad Gateway upstream unavailable');
    assert.equal(summarizeHTMLError(parsed, 502), 'Bad Gateway upstream unavailable');
});

test('html-error: parseHTMLError - Tomcat Exception Report', () => {
    const parsed = parseHTMLError(TOMCAT);
    assert.ok(parsed);

    assert.equal(parsed.title, 'HTTP Status 500 – Internal Server Error');
    assert.deepEqual(parsed.fields, {
        Type: 'Exception Report',
        Message: 'Exception performing TAK Server authentication',
        Description: 'The server encountered an unexpected condition that prevented it from fulfilling the request.',
        Note: 'The full stack trace of the root cause is available in the server logs.',
    });

    assert.ok(parsed.exception);
    assert.ok(parsed.exception.startsWith('org.springframework.security.authentication.BadCredentialsException: Exception performing TAK Server authentication\n'));
    assert.ok(parsed.exception.includes('TakAuthenticationProvider.java:244'));
    assert.ok(!parsed.exception.endsWith('\n'));

    // Styles & exception body are excluded from the text fallback
    assert.ok(!parsed.text.includes('font-family'));
    assert.ok(!parsed.text.includes('TakAuthenticationProvider'));
    assert.ok(parsed.text.includes('Apache Tomcat/9.0.86'));

    assert.equal(summarizeHTMLError(parsed), 'Exception performing TAK Server authentication');

    const formatted = formatHTMLError(parsed);
    assert.equal(formatted.split('\n').slice(0, 6).join('\n'), [
        'HTTP Status 500 – Internal Server Error',
        'Type: Exception Report',
        'Message: Exception performing TAK Server authentication',
        'Description: The server encountered an unexpected condition that prevented it from fulfilling the request.',
        'Note: The full stack trace of the root cause is available in the server logs.',
        '',
    ].join('\n'));
    assert.ok(formatted.endsWith('ProviderManager.authenticate(ProviderManager.java:181)'));
});

test('html-error: parseHTMLError - status page without Message', () => {
    const parsed = parseHTMLError('<!doctype html><html><head><title>HTTP Status 404 &ndash; Not Found</title></head><body><h1>HTTP Status 404 &ndash; Not Found</h1><p><b>Type</b> Status Report</p><p><b>Description</b> The origin server did not find a current representation for the target resource.</p></body></html>');
    assert.ok(parsed);
    assert.equal(summarizeHTMLError(parsed, 404), 'The origin server did not find a current representation for the target resource.');
});

test('html-error: parseHTMLError - exception only', () => {
    const parsed = parseHTMLError('<html><body><pre>java.lang.IllegalStateException: Mission already exists</pre></body></html>');
    assert.ok(parsed);
    assert.equal(summarizeHTMLError(parsed), 'Mission already exists');
    assert.equal(formatHTMLError(parsed), 'java.lang.IllegalStateException: Mission already exists');
});

test('html-error: parseHTMLError - unstructured HTML', () => {
    const parsed = parseHTMLError('<html><body><div>Service Unavailable</div></body></html>');
    assert.ok(parsed);
    assert.equal(parsed.title, undefined);
    assert.equal(summarizeHTMLError(parsed, 503), 'Service Unavailable');
    assert.equal(formatHTMLError(parsed), 'Service Unavailable');

    assert.equal(parseHTMLError('not html'), null);
});

test('html-error: TAKServerError', () => {
    const err = new TAKServerError(500, TOMCAT);

    assert.ok(err instanceof Err);
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PublicError');
    assert.equal(err.status, 500);
    assert.equal(err.message, 'Exception performing TAK Server authentication');
    assert.equal(err.safe, 'Exception performing TAK Server authentication');
    assert.ok(err.details.startsWith('HTTP Status 500 – Internal Server Error\nType: Exception Report\n'));
    assert.ok(err.details.includes('BadCredentialsException'));
    assert.equal(err.html, TOMCAT);
    assert.equal(err.parsed.fields.Type, 'Exception Report');
});
