import Err from '@openaddresses/batch-error';
import xmljs from 'xml-js';
import { Type, Static } from '@sinclair/typebox';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import Commands from '../commands.js';

export const HistoryOptions = Type.Object({
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String()),
    secago: Type.Optional(Type.String()),
})

export default class QueryCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async singleFeat(uid: string): Promise<Static<typeof Feature.Feature>> {
        const cotstr = await this.single(uid);
        return CoTParser.to_geojson(CoTParser.from_xml(cotstr))
    }

    async single(uid: string): Promise<string> {
        const url = new URL(`/Marti/api/cot/xml/${encodeURIComponent(uid)}`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const body = await res.text();

        if (body.trim().length === 0) {
            throw new Err(404, null, 'CoT by that UID Not Found');
        }

        return body;
    }

    async historyFeats(uid: string, opts?: Static<typeof HistoryOptions>): Promise<Array<Static<typeof Feature.Feature>>> {
        const feats: Static<typeof Feature.Feature>[] = [];

        const res: any = xmljs.xml2js(await this.history(uid, opts), { compact: true });

        if (!Object.keys(res).length || !Object.keys(res.events).length) return feats;
        if (!res.events.event || (Array.isArray(res.events.event) && !res.events.event.length)) return feats;

        for (const event of Array.isArray(res.events.event) ? res.events.event : [res.events.event] ) {
            feats.push(CoTParser.to_geojson(new CoT({ event })));
        }

        return feats;
    }

    async history(uid: string, opts?: Static<typeof HistoryOptions>): Promise<string> {
        const url = new URL(`/Marti/api/cot/xml/${encodeURIComponent(uid)}/all`, this.api.url);

        if (opts) {
            let q: keyof Static<typeof HistoryOptions>;
            for (q in opts) {
                if (opts[q] !== undefined) {
                    url.searchParams.append(q, String(opts[q]));
                }
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const body = await res.text();

        console.error(body);

        return body;
    }
}
