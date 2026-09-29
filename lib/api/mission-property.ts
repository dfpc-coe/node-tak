import { Type, Static } from '@sinclair/typebox';
import { TAKItem, TAKList } from './types.js';
import type { MissionOptions } from './mission.js';
import Commands from '../commands.js';
import { GUIDMatch } from './mission.js';

export const MissionProperty = Type.Object({
    key: Type.String(),
    value: Type.String()
});

export const MissionPropertyListInput = Type.Object({
    prefix: Type.Optional(Type.String({
        description: 'Only return properties whose key starts with this prefix'
    }))
});

export const SetMissionProperty = Type.Object({
    key: Type.String(),
    value: Type.String(),
    creatorUid: Type.String()
});

export const TAKItem_MissionProperty = TAKItem(MissionProperty);
export const TAKList_MissionProperty = TAKList(MissionProperty);

/**
 * Key/Value properties stored on a Mission Sync
 *
 * Requires TAK Server 5.9 or later
 */
export default class MissionPropertyCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    #headers(opts?: Static<typeof MissionOptions>): object {
        if (opts && opts.token) {
            return {
                MissionAuthorization: `Bearer ${opts.token}`
            }
        } else {
            return {};
        }
    }

    /**
     * Property endpoints are only exposed by GUID, resolve a Mission name if needed
     */
    async #guid(
        mission: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<string> {
        if (GUIDMatch.test(mission)) return mission;

        return (await this.api.Mission.get(mission, {}, opts)).guid;
    }

    /**
     * List properties on a Mission Sync, optionally filtered by key prefix
     */
    async list(
        mission: string,
        query: Static<typeof MissionPropertyListInput> = {},
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKList_MissionProperty>> {
        const guid = await this.#guid(mission, opts);
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}/properties`, this.api.url);

        if (query.prefix !== undefined) url.searchParams.append('prefix', query.prefix);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Get a single property on a Mission Sync
     */
    async get(
        mission: string,
        key: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionProperty>> {
        const guid = await this.#guid(mission, opts);
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}/properties/${encodeURIComponent(key)}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Create or update (upsert) a property on a Mission Sync
     */
    async set(
        mission: string,
        body: Static<typeof SetMissionProperty>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionProperty>> {
        const guid = await this.#guid(mission, opts);
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}/properties`, this.api.url);
        url.searchParams.append('creatorUid', body.creatorUid);

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
            body: {
                key: body.key,
                value: body.value
            }
        });
    }

    /**
     * Delete a single property on a Mission Sync
     */
    async delete(
        mission: string,
        key: string,
        creatorUid: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<void> {
        const guid = await this.#guid(mission, opts);
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}/properties/${encodeURIComponent(key)}`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts)
        });
    }

    /**
     * Delete all properties on a Mission Sync
     */
    async deleteAll(
        mission: string,
        creatorUid: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<void> {
        const guid = await this.#guid(mission, opts);
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}/properties`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts)
        });
    }
}
