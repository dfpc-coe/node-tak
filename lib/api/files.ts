import type { ParsedArgs } from 'minimist'
import { Readable } from 'node:stream';
import { openAsBlob } from 'node:fs';
import mime from 'mime';
import Commands, { CommandOutputFormat } from '../commands.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import stream2buffer from '../stream.js';

export const Content = Type.Object({
  UID: Type.String(),
  SubmissionDateTime: Type.String(),
  Keywords: Type.Array(Type.String()),
  MIMEType: Type.String(),
  SubmissionUser: Type.String(),
  PrimaryKey: Type.String(),
  Hash: Type.String(),
  CreatorUid: Type.String(),
  Name: Type.String()
});

export const TAKList_Content = TAKList(Type.Object({
    filename: Type.String(),
    keywords: Type.Array(Type.String()),
    mimeType: Type.String(),
    name: Type.String(),
    submissionTime: Type.String(),
    submitter: Type.String(),
    uid: Type.String(),
    size: Type.Integer(),
}));

export const Config = Type.Object({
    uploadSizeLimit: Type.Integer()
})

export default class FileCommands extends Commands {
    schema = {
        list: {
            description: 'List Files',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((data) => {
                    return data.filename;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(): Promise<Static<typeof TAKList_Content>> {
        const url = new URL(`/Marti/api/sync/search`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async meta(hash: string): Promise<string> {
        const url = new URL(`/Marti/sync/${encodeURIComponent(hash)}/metadata`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const body = await res.text();

        return body;
    }

    async download(hash: string): Promise<Readable> {
        const url = new URL(`/Marti/sync/content`, this.api.url);
        url.searchParams.append('hash', hash);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        return res.body;
    }

    async adminDelete(hash: string) {
        const url = new URL(`/Marti/api/files/${hash}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async delete(hash: string) {
        const url = new URL(`/Marti/sync/delete`, this.api.url);
        url.searchParams.append('hash', hash)

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    // TODO Return a Content Object
    async uploadPackage(opts: {
        name: string;
        creatorUid: string;
        hash: string;
    }, body: Readable | Buffer): Promise<string> {
        const url = new URL(`/Marti/sync/missionupload`, this.api.url);
        url.searchParams.append('filename', opts.name)
        url.searchParams.append('creatorUid', opts.creatorUid)
        url.searchParams.append('hash', opts.hash)

        const form = new FormData();

        if (body instanceof Buffer) {
            // Handle Buffer directly
            form.append('assetfile', new Blob([new Uint8Array(body)]), opts.name);
        } else if (body instanceof Readable && 'path' in body && typeof body.path === 'string') {
            // Use fs.openAsBlob for file streams - memory efficient
            const fileBlob = await openAsBlob(body.path as string);
            form.append('assetfile', fileBlob, opts.name);
        } else {
            // Fall back to buffer approach for other streams
            const fileData = await stream2buffer(body as import('node:stream').Stream);
            form.append('assetfile', new Blob([new Uint8Array(fileData)]), opts.name);
        }

        const res = await this.api.fetch(url, {
            method: 'POST',
            body: form
        }) as string;

        return res;
    }

    async upload(opts: {
        name: string;
        contentLength: number;
        contentType?: string;
        keywords: string[];
        creatorUid: string;
        latitude?: string;
        longitude?: string;
        altitude?: string;
    }, body: Readable | Buffer): Promise<Static<typeof Content>> {
        const url = new URL(`/Marti/sync/upload`, this.api.url);
        url.searchParams.append('name', opts.name)
        url.searchParams.append('keywords', opts.keywords.join(','))
        url.searchParams.append('creatorUid', opts.creatorUid)
        if (opts.altitude) url.searchParams.append('altitude', opts.altitude);
        if (opts.longitude) url.searchParams.append('longitude', opts.longitude);
        if (opts.latitude) url.searchParams.append('latitude', opts.latitude);

        if (body instanceof Buffer) {
            body = Readable.from(body as Buffer);
        }

        const res = await this.api.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': opts.contentType ? opts.contentType : mime.getType(opts.name),
                'Content-Length': opts.contentLength
            },
            body: body as Readable
        });

        return JSON.parse(res);
    }

    async count() {
        const url = new URL('/Marti/api/files/metadata/count', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async config(): Promise<Static<typeof Config>> {
        const url = new URL('/files/api/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
