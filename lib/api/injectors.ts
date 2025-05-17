import { TAKList } from './types.js';
import type { ParsedArgs } from 'minimist'
import { Type, Static } from '@sinclair/typebox';
import Commands from '../commands.js';

export const Injector = Type.Object({
    uid: Type.String(),
    toInject: Type.String()
})

export const TAKList_Injector = TAKList(Injector);

export default class InjectorCommands extends Commands {
    schema = {
        list: {
            description: 'List Injectors',
            params: Type.Object({}),
            query: Type.Object({})
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((injector) => {
                    return `${injector.uid} - ${injector.toInject}`;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
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
