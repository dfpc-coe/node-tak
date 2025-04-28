import TAKAPI from '../api.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';

export const Repeater = Type.Object({
    uid: Type.String(),
    repeatType: Type.String(),
    cotType: Type.String(),
    dateTimeActivated: Type.String(),
    xml: Type.String(),
    callsign: Type.String(),
})

export const TAKList_Repeater = TAKList(Repeater);

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
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
}
