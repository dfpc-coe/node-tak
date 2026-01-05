import type { ParsedArgs } from 'minimist'
import { Type, Static } from '@sinclair/typebox';
import { TAKList } from './types.js';
import { GUIDMatch, MissionOptions } from './mission.js';
import Commands, { CommandOutputFormat } from '../commands.js';

export enum MissionSubscriberRole {
    MISSION_OWNER = 'MISSION_OWNER',
    MISSION_SUBSCRIBER = 'MISSION_SUBSCRIBER',
    MISSION_READONLY_SUBSCRIBER = 'MISSION_READONLY_SUBSCRIBER'
}

export enum MissionInviteType {
    CLIENT_UID = 'clientUid',
    CALLSIGN = 'callsign',
    USERNAME = 'userName',
    GROUP = 'group',
    TEAM = 'team'
}

export const MissionInvite = Type.String();

export const TAKList_MissionInvites = TAKList(MissionInvite);

/**
 * @class
 */
export default class MissionInviteCommands extends Commands {
    schema = {
        list: {
            description: 'List Mission Invites',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        invite: {
            description: 'Invite a user/group to a mission',
            params: Type.Object({
                name: Type.String(),
                type: Type.Enum(MissionInviteType),
                invitee: Type.String()
            }),
            query: Type.Object({
                creatorUid: Type.String(),
                role: Type.Optional(Type.Enum(MissionSubscriberRole))
            }),
            formats: [ CommandOutputFormat.JSON ]
        },
        uninvite: {
            description: 'Uninvite a user/group from a mission',
            params: Type.Object({
                name: Type.String(),
                type: Type.Enum(MissionInviteType),
                invitee: Type.String()
            }),
            query: Type.Object({
                creatorUid: Type.String()
            }),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list(args.clientUid, {
                token: args.token
            });

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((invite) => {
                    return `${invite}`;
                }).join('\n');
            }
        } else if (args._[3] === 'invite') {
            const name = args._[4];
            const type = args._[5] as MissionInviteType;
            const invitee = args._[6];

            if (!name || !type || !invitee) throw new Error('Usage: invite <name> <type> <invitee>');

            await this.invite(name, type, invitee, {
                creatorUid: args.creatorUid,
                role: args.role
            }, {
                token: args.token
            });
            return { message: 'OK' };
        } else if (args._[3] === 'uninvite') {
            const name = args._[4];
            const type = args._[5] as MissionInviteType;
            const invitee = args._[6];

            if (!name || !type || !invitee) throw new Error('Usage: uninvite <name> <type> <invitee>');

            await this.uninvite(name, type, invitee, {
                creatorUid: args.creatorUid
            }, {
                token: args.token
            });
            return { message: 'OK' };
        } else {
            throw new Error('Unsupported Subcommand');
        }
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
     * List all Invitations for missions
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getAllMissionInvitations TAK Server Docs}.
     */
    async list(
        clientUid?: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKList_MissionInvites>> {
        const url = new URL('/Marti/api/missions/all/invitations', this.api.url);

        if (clientUid) {
            url.searchParams.append('clientUid', clientUid);
        }

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Invite a user/group to a mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/inviteToMission TAK Server Docs}.
     */
    async invite(
        missionName: string,
        type: MissionInviteType,
        invitee: string,
        query: {
            creatorUid: string;
            role?: MissionSubscriberRole;
        },
        opts?: Static<typeof MissionOptions>
    ): Promise<void> {
        let url;
        if (GUIDMatch.test(missionName)) {
            url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(missionName)}/invite/${encodeURIComponent(type)}/${encodeURIComponent(invitee)}`, this.api.url);
        } else {
            url = new URL(`/Marti/api/missions/${encodeURIComponent(missionName)}/invite/${encodeURIComponent(type)}/${encodeURIComponent(invitee)}`, this.api.url);
        }

        for (const q in query) url.searchParams.append(q, String(query[q as keyof typeof query]));

        await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts)
        });
    }

    /**
     * Uninvite a user/group from a mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/uninviteFromMission TAK Server Docs}.
     */
    async uninvite(
        missionName: string,
        type: MissionInviteType,
        invitee: string,
        query: {
            creatorUid: string;
        },
        opts?: Static<typeof MissionOptions>
    ): Promise<void> {
        let url;
        if (GUIDMatch.test(missionName)) {
            url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(missionName)}/invite/${encodeURIComponent(type)}/${encodeURIComponent(invitee)}`, this.api.url);
        } else {
            url = new URL(`/Marti/api/missions/${encodeURIComponent(missionName)}/invite/${encodeURIComponent(type)}/${encodeURIComponent(invitee)}`, this.api.url);
        }

        for (const q in query) url.searchParams.append(q, String(query[q as keyof typeof query]));

        await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts)
        });
    }
}
