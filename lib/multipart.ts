import crypto from 'node:crypto';
import { Readable } from 'node:stream';

type MultipartBufferPart = {
    header: Buffer;
    kind: 'buffer';
    body: Buffer;
    trailer: Buffer;
    size: number;
};

type MultipartFilePart = {
    header: Buffer;
    kind: 'file';
    body: File;
    trailer: Buffer;
    size: number;
};

type MultipartPart = MultipartBufferPart | MultipartFilePart;

function escapeQuoted(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function encodeMultipartFormData(form: FormData): Promise<{
    body: Readable;
    headers: {
        'Content-Type': string;
        'Content-Length': string;
    };
}> {
    const boundary = `----node-tak-${crypto.randomUUID()}`;
    const closing = Buffer.from(`--${boundary}--\r\n`);

    const parts: MultipartPart[] = Array.from(form.entries()).map(([name, value]) => {
        if (typeof value === 'string') {
            const header = Buffer.from(
                `--${boundary}\r\n`
                + `Content-Disposition: form-data; name="${escapeQuoted(name)}"\r\n\r\n`
            );
            const body = Buffer.from(value);
            const trailer = Buffer.from('\r\n');

            return {
                header,
                kind: 'buffer',
                body,
                trailer,
                size: header.length + body.length + trailer.length,
            };
        }

        const filename = 'name' in value && typeof value.name === 'string'
            ? value.name
            : 'blob';
        const type = value.type || 'application/octet-stream';
        const header = Buffer.from(
            `--${boundary}\r\n`
            + `Content-Disposition: form-data; name="${escapeQuoted(name)}"; filename="${escapeQuoted(filename)}"\r\n`
            + `Content-Type: ${type}\r\n\r\n`
        );
        const trailer = Buffer.from('\r\n');

        return {
            header,
            kind: 'file',
            body: value,
            trailer,
            size: header.length + value.size + trailer.length,
        };
    });

    const contentLength = parts.reduce((sum, part) => sum + part.size, 0) + closing.length;

    const body = Readable.from((async function*() {
        for (const part of parts) {
            yield part.header;

            if (part.kind === 'buffer') {
                yield part.body;
            } else {
                yield Buffer.from(await part.body.arrayBuffer());
            }

            yield part.trailer;
        }

        yield closing;
    })());

    return {
        body,
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(contentLength),
        }
    };
}
