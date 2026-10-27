import Err from '@openaddresses/batch-error';
import { xml2js } from '@tak-ps/xml-js';
import { Type, Static } from '@sinclair/typebox';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import Commands from '../commands.js';

export const HistoryOptions = Type.Object({
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String()),
    secago: Type.Optional(Type.String()),
})

/** TAK Server refuses Situational Awareness windows longer than this */
export const SA_MAX_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * Options for the Situational Awareness query - every CoT the caller's groups
 * can see within a time window of at most 24 hours
 */
export const SituationalAwarenessOptions = Type.Object({
    start: Type.Optional(Type.String({ description: 'ISO 8601 start of the window (inclusive). Defaults to `end` minus `secago`' })),
    end: Type.Optional(Type.String({ description: 'ISO 8601 end of the window (inclusive). Defaults to now' })),
    secago: Type.Optional(Type.Union([Type.Integer(), Type.String()], {
        description: 'Window length in seconds counted back from `end`. Default is 3600 when `start` is omitted'
    })),
    bbox: Type.Optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()], {
        description: 'Restrict to events within [minLon, minLat, maxLon, maxLat]'
    })),
    filtered: Type.Optional(Type.Boolean({
        description: 'TAK Server default (true) only returns a-f, a-n, a-u, a-h & b-m-r events plus chat; false returns every stored event'
    })),
})

/** The explicit window TAK Server is queried with once the options are resolved */
export const SituationalAwarenessWindow = Type.Object({
    start: Type.String({ description: 'ISO 8601 start of the window (inclusive)' }),
    end: Type.String({ description: 'ISO 8601 end of the window (inclusive)' }),
})

export default class QueryCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async singleFeat(uid: string): Promise<Static<typeof Feature.Feature>> {
        const cotstr = await this.single(uid);

        try {
            return CoTParser.to_geojson(CoTParser.from_xml(cotstr))
        } catch (err) {
            throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'TAK Server returned an unparsable CoT for this UID');
        }
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
        return this.parseEvents(await this.history(uid, opts));
    }

    /**
     * Parse an `<events>` document into GeoJSON Features - an empty body
     * (TAK Server answers 404 with no body when nothing matched) yields []
     */
    private async parseEvents(xml: string): Promise<Array<Static<typeof Feature.Feature>>> {
        const feats: Static<typeof Feature.Feature>[] = [];

        if (!xml || !xml.trim().length) return feats;

        const res: any = xml2js(xml, { compact: true });

        if (!Object.keys(res).length || !res.events || !Object.keys(res.events).length) return feats;
        if (!res.events.event || (Array.isArray(res.events.event) && !res.events.event.length)) return feats;

        for (const event of Array.isArray(res.events.event) ? res.events.event : [res.events.event] ) {
            feats.push(await CoTParser.to_geojson(new CoT({ event })));
        }

        return feats;
    }

    async saFeats(opts: Static<typeof SituationalAwarenessOptions> = {}): Promise<Array<Static<typeof Feature.Feature>>> {
        return this.parseEvents(await this.sa(opts));
    }

    /**
     * Raw XML of every CoT visible to the caller within the time window.
     * TAK Server requires an explicit start & end and refuses inverted or
     * >24 hour windows, so those are resolved and rejected here
     */
    async sa(opts: Static<typeof SituationalAwarenessOptions> = {}): Promise<string> {
        const url = new URL('/Marti/api/cot/sa', this.api.url);

        const end = opts.end ? new Date(opts.end) : new Date();
        if (Number.isNaN(end.getTime())) throw new Err(400, null, 'end must be an ISO 8601 date');

        let start: Date;
        if (opts.start) {
            start = new Date(opts.start);
            if (Number.isNaN(start.getTime())) throw new Err(400, null, 'start must be an ISO 8601 date');
        } else {
            const secago = opts.secago === undefined ? 3600 : Number(opts.secago);
            if (!Number.isInteger(secago) || secago < 1) throw new Err(400, null, 'secago must be a positive integer');
            start = new Date(end.getTime() - secago * 1000);
        }

        if (start.getTime() > end.getTime()) throw new Err(400, null, 'start must be before end');
        if (end.getTime() - start.getTime() > SA_MAX_WINDOW_SECONDS * 1000) throw new Err(400, null, 'Window must be 24 hours or less');

        const window: Static<typeof SituationalAwarenessWindow> = {
            start: start.toISOString(),
            end: end.toISOString(),
        };

        url.searchParams.append('start', window.start);
        url.searchParams.append('end', window.end);

        if (opts.bbox) {
            url.searchParams.append('left', String(opts.bbox[0]));
            url.searchParams.append('bottom', String(opts.bbox[1]));
            url.searchParams.append('right', String(opts.bbox[2]));
            url.searchParams.append('top', String(opts.bbox[3]));
        }

        if (opts.filtered !== undefined) {
            url.searchParams.append('isFiltered', String(opts.filtered));
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        return await res.text();
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

        return body;
    }
}
