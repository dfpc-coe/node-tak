import Err from '@openaddresses/batch-error';
import xmljs from '@tak-ps/xml-js';
import type { Element } from '@tak-ps/xml-js';

/**
 * TAK Server (Tomcat) returns HTML "Exception Report" pages on failure.
 * Parse them into a human readable message + plain-text details
 * so clients don't render raw HTML.
 */
export interface HTMLErrorDetails {
    /** <title> or <h1> */
    title?: string;
    /** <p><b>Label</b> value</p> pairs - ie: Type, Message, Description */
    fields: Record<string, string>;
    /** <pre> stack traces */
    exception?: string;
    /** Visible text fallback */
    text: string;
}

const HIDDEN = new Set(['style', 'script', 'head']);

function collapse(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
}

/** Linear-time tag stripper for malformed HTML - drops the contents of HIDDEN elements */
function stripTags(html: string): string {
    let out = '';
    let i = 0;

    while (i < html.length) {
        const open = html.indexOf('<', i);
        if (open === -1) {
            out += html.slice(i);
            break;
        }

        out += html.slice(i, open) + ' ';

        const close = html.indexOf('>', open);
        if (close === -1) break;

        const tag = html.slice(open + 1, close).trim().split(/\s/, 1)[0].toLowerCase();
        i = close + 1;

        if (HIDDEN.has(tag)) {
            const end = html.toLowerCase().indexOf(`</${tag}`, i);
            if (end === -1) break;
            i = html.indexOf('>', end);
            if (i === -1) break;
            i += 1;
        }
    }

    return collapse(out);
}

function textOf(el: Element, opts: { skipPre?: boolean } = {}): string {
    if (el.type === 'text') return String(el.text ?? '');
    if (el.type !== 'element' || !el.elements) return '';
    if (opts.skipPre && el.name === 'pre') return '';

    return el.elements.map((child) => textOf(child, opts)).join('');
}

function* walk(el: Element, skipHidden = true): Generator<Element> {
    if (el.type === 'element' && el.name && skipHidden && HIDDEN.has(el.name.toLowerCase())) return;

    if (el.type === 'element') yield el;

    for (const child of el.elements || []) yield* walk(child, skipHidden);
}

function find(root: Element, name: string): Element | undefined {
    for (const el of walk(root, false)) {
        if (el.name?.toLowerCase() === name) return el;
    }
}

export function isHTML(body: unknown): body is string {
    if (typeof body !== 'string') return false;

    const head = body.slice(0, 512).trimStart().toLowerCase();

    return head.startsWith('<!doctype html')
        || head.startsWith('<html')
        || /^<(head|body|title|h1)[\s>]/.test(head);
}

/** Returns null if body is not HTML */
export function parseHTMLError(body: unknown): HTMLErrorDetails | null {
    if (!isHTML(body)) return null;

    const details: HTMLErrorDetails = {
        fields: {},
        text: '',
    };

    let root: Element;
    try {
        root = xmljs.xml2js(body, { compact: false }) as Element;
    } catch {
        // Not well-formed XHTML - fall back to visible text
        details.text = stripTags(body);

        return details;
    }

    const title = find(root, 'title') || find(root, 'h1');
    if (title && collapse(textOf(title))) details.title = collapse(textOf(title));

    const pres: string[] = [];
    let text = '';

    for (const el of walk(root)) {
        const name = el.name?.toLowerCase();

        if (name === 'p' && el.elements?.[0]?.name?.toLowerCase() === 'b') {
            const label = collapse(textOf(el.elements[0]));
            const value = collapse(el.elements.slice(1).map((child) => textOf(child)).join(''));

            if (label && value) details.fields[label] = value;
        } else if (name === 'pre') {
            const value = textOf(el)
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n')
                .trim();

            if (value) pres.push(value);
        } else if (name === 'body') {
            text = collapse(textOf(el, { skipPre: true }));
        }
    }

    if (pres.length) details.exception = pres.join('\n\n');

    details.text = text || collapse(textOf(root, { skipPre: true }));

    return details;
}

/** Most useful human readable line from the page */
export function summarizeHTMLError(details: HTMLErrorDetails, status?: number): string {
    const message = details.fields.Message
        || details.fields.message
        || details.fields.Description
        || details.fields.description;

    if (message) return message;

    if (details.exception) {
        // "<ExceptionClass>: <message>"
        const first = details.exception.split('\n')[0].trim();
        const colon = first.indexOf(': ');
        if (colon !== -1 && colon < first.length - 2) return first.slice(colon + 2).trim();
    }

    if (details.title) return details.title;

    if (details.text) return details.text.length > 200 ? details.text.slice(0, 197) + '...' : details.text;

    return status ? `Status Code: ${status}` : 'Unknown TAK Server Error';
}

/** Plain-text breakdown for an "Advanced" details pane */
export function formatHTMLError(details: HTMLErrorDetails): string {
    const lines: string[] = [];

    if (details.title) lines.push(details.title);

    for (const [label, value] of Object.entries(details.fields)) {
        if (value) lines.push(`${label}: ${value}`);
    }

    if (details.exception) {
        if (lines.length) lines.push('');
        lines.push(details.exception);
    }

    if (!lines.length && details.text) lines.push(details.text);

    return lines.join('\n');
}

/**
 * TAK Server HTML error page - `safe` is the summary, `details` the full breakdown
 */
export class TAKServerError extends Err {
    details: string;
    html: string;
    parsed: HTMLErrorDetails;

    constructor(status: number, html: string, parsed?: HTMLErrorDetails) {
        const details = parsed || parseHTMLError(html) || {
            fields: {},
            text: stripTags(html)
        };

        super(status, null, summarizeHTMLError(details, status));

        this.parsed = details;
        this.details = formatHTMLError(details);
        this.html = html;
    }
}
