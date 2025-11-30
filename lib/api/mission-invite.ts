import type { ParsedArgs } from 'minimist'
import { Type, Static } from '@sinclair/typebox';
import { TAKList } from './types.js';
import Commands, { CommandOutputFormat } from '../commands.js';

export enum MissionSubscriberRole {
    MISSION_OWNER = 'MISSION_OWNER',
    MISSION_SUBSCRIBER = 'MISSION_SUBSCRIBER',
    MISSION_READONLY_SUBSCRIBER = 'MISSION_READONLY_SUBSCRIBER'
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
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((invite) => {
                    return `${invite}`;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    /**
     * List all Invitations for missions
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getAllMissionInvitations TAK Server Docs}.
     */
    async list(clientUid?: string): Promise<Static<typeof TAKList_MissionInvites>> {
        const url = new URL('/Marti/api/missions/all/invitations', this.api.url);

        if (clientUid) {
            url.searchParams.append('clientUid', clientUid);
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
