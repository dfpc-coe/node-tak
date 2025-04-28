import TAKAPI from '../api.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';

export const Injector = Type.Object({
    uid: Type.String(),
    toInject: Type.String()
})

export const TAKList_Injector = TAKList(Injector);

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    /**
     * Return a list of all configured COT Injectors
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/injection-api/operation/getAllCotInjectors TAK Server Docs}.
     */
    async list(): Promise<Static<typeof TAKList_Injector>> {
        const url = new URL('/Marti/api/injectors/cot/uid', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Return a sing configured COT Injectors for a given UID
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/injection-api/operation/getOneCotInjector TAK Server Docs}.
     */
    async get(uid: string): Promise<Static<typeof TAKList_Injector>> {
        const url = new URL(`/Marti/api/injectors/cot/uid/${encodeURIComponent(uid)}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Remove a COT Injector
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/injection-api/operation/putCotInjector TAK Server Docs}.
     */
    async create(injector: Static<typeof Injector>): Promise<Static<typeof TAKList_Injector>> {
        const url = new URL('/Marti/api/injectors/cot/uid', this.api.url);

        return await this.api.fetch(url, {
            method: 'POST',
            body: injector
        });
    }

    /**
     * Remove a COT Injector
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/injection-api/operation/deleteInjector TAK Server Docs}.
     */
    async delete(injector: Static<typeof Injector>): Promise<Static<typeof TAKList_Injector>> {
        const url = new URL('/Marti/api/injectors/cot/uid', this.api.url);

        url.searchParams.append('uid', injector.uid);
        url.searchParams.append('toInject', injector.toInject);

        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }
}
