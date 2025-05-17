import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import Commands from '../commands.js';

export const Repeater = Type.Object({
    uid: Type.String(),
    repeatType: Type.String(),
    cotType: Type.String(),
    dateTimeActivated: Type.String(),
    xml: Type.String(),
    callsign: Type.String(),
})

export const TAKList_Repeater = TAKList(Repeater);

export default class RepeaterCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    /**
     * Return or set the current rebroadcast period
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/repeater-api/operation/getPeriod TAK Server Docs}.
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/repeater-api/operation/setPeriod TAK Server Docs}.
     */
    async period(period?: number): Promise<number> {
        const url = new URL('/Marti/api/repeater/period', this.api.url);
        if (period === undefined) {
            return await this.api.fetch(url, {
                method: 'GET'
            });
        } else {
            await this.api.fetch(url, {
                method: 'POST',
                body: period
            });

            return period;
        }
    }

    /**
     * Return a list of all configured COT Repeaters
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/repeater-api/operation/getList TAK Server Docs}.
     */
    async list(): Promise<Static<typeof TAKList_Repeater>> {
        const url = new URL('/Marti/api/repeater/list', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Delete a repeater by UID
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/repeater-api/operation/remove TAK Server Docs}.
     */
    async delete(uid: string): Promise<void> {
        const url = new URL(`/Marti/api/repeater/remove/${uid}`, this.api.url);

        await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
