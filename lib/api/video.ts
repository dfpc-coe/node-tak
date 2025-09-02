import Err from '@openaddresses/batch-error';
import type { ParsedArgs } from 'minimist'
import { Static, Type } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import Commands, { CommandOutputFormat } from '../commands.js';

export const FeedInput = Type.Object({
    uuid: Type.Optional(Type.String()),
    active: Type.Boolean({ default: true }),
    alias: Type.String(),
    url: Type.String(),
});

export const VideoConnectionCreateInput = Type.Object({
    groups: Type.Optional(Type.Array(Type.String())),
    uuid: Type.Optional(Type.String()),
    active: Type.Boolean({
        default: true
    }),
    alias: Type.String(),
    feeds: Type.Array(FeedInput)
});

export const VideoConnectionUpdateInput = Type.Object({
    uuid: Type.Optional(Type.String()),
    active: Type.Boolean({
        default: true
    }),
    alias: Type.String(),
    feeds: Type.Array(FeedInput)
});

export const Feed = Type.Object({
    uuid: Type.String(),
    active: Type.Boolean(),
    alias: Type.String(),
    url: Type.String(),

    order: Type.Union([Type.Integer(), Type.Null()]),
    macAddress: Type.String(),
    roverPort: Type.String(),
    ignoreEmbeddedKLV: Type.String(),
    source: Type.Union([Type.String(), Type.Null()]),
    networkTimeout: Type.String(),
    bufferTime: Type.String(),
    rtspReliable: Type.String(),
    thumbnail: Type.Union([Type.String(), Type.Null()]),
    classification: Type.Union([Type.String(), Type.Null()]),
    latitude: Type.Union([Type.String(), Type.Null()]),
    longitude: Type.Union([Type.String(), Type.Null()]),
    fov: Type.Union([Type.String(), Type.Null()]),
    heading: Type.Union([Type.String(), Type.Null()]),
    range: Type.Union([Type.String(), Type.Null()]),
    width: Type.Union([Type.Integer(), Type.Null()]),
    height: Type.Union([Type.Integer(), Type.Null()]),
    bitrate: Type.Union([Type.Integer(), Type.Null()]),
});

export const VideoConnection = Type.Object({
    uuid: Type.String(),
    active: Type.Boolean(),
    alias: Type.String(),
    thumbnail: Type.Union([Type.String(), Type.Null()]),
    classification: Type.Union([Type.String(), Type.Null()]),
    feeds: Type.Array(Feed)
})

export const VideoConnectionList = Type.Object({
    videoConnections: Type.Array(VideoConnection)
});

export const VideoConnectionListInput = Type.Object({
    protocol: Type.Optional(Type.String())
})

export default class VideoCommands extends Commands {
    schema = {
        list: {
            description: 'List V2 Video Configs',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            return await this.list()
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(
        query: Static<typeof VideoConnectionListInput> = {}
    ): Promise<Static<typeof VideoConnectionList>> {
        const url = new URL(`/Marti/api/video`, this.api.url);

        let q: keyof Static<typeof VideoConnectionListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async update(
        connection: Static<typeof VideoConnectionUpdateInput>
    ): Promise<Static<typeof VideoConnection>> {
        const url = new URL(`/Marti/api/video/${connection.uuid}`, this.api.url);

        if (!connection.uuid) throw new Err(400, null, 'UUID must be set when updating Video');

        await this.api.fetch(url, {
            method: 'PUT',
            body: {
                ...connection,
                feeds: connection.feeds.map((feed) => {
                    if (!feed.uuid) feed.uuid = randomUUID();
                    return feed;
                })
            }
        });

        return await this.get(connection.uuid);
    }

    async create(
        connection: Static<typeof VideoConnectionCreateInput>
    ): Promise<Static<typeof VideoConnection>> {
        const url = new URL(`/Marti/api/video`, this.api.url);

        const uuid = connection.uuid || randomUUID();

        if (connection.groups) {
            for (const group of connection.groups) {
                url.searchParams.append('group', group);
            }

            delete connection.groups;
        }

        await this.api.fetch(url, {
            method: 'POST',
            body: {
                videoConnections: [{
                    uuid,
                    ...connection,
                    feeds: connection.feeds.map((feed) => {
                        return {
                            uuid: randomUUID(),
                            ...feed,
                        }
                    })
                }]
            }
        });

        return await this.get(uuid);
    }

    async get(
        uid: string
    ): Promise<Static<typeof VideoConnection>> {
        const url = new URL(`/Marti/api/video/${encodeURIComponent(uid)}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async delete(
        uid: string
    ): Promise<void> {
        const url = new URL(`/Marti/api/video/${encodeURIComponent(uid)}`, this.api.url);

        await this.api.fetch(url, {
            method: 'DELETE'
        });
    }
}
