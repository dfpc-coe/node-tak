import FormData from 'form-data';
import OAuth from './api/oauth.js';
import Package from './api/package.js';
import Query from './api/query.js';
import Locate from './api/locate.js';
import Mission from './api/mission.js';
import MissionInvite from './api/mission-invite.js';
import MissionLog from './api/mission-log.js';
import MissionLayer from './api/mission-layer.js';
import Credentials from './api/credentials.js';
import Security from './api/security.js';
import Contacts from './api/contacts.js';
import Profile from './api/profile.js';
import Files from './api/files.js';
import Iconsets from './api/iconsets.js';
import Injectors from './api/injectors.js';
import Repeater from './api/repeater.js';
import Group from './api/groups.js';
import Subscription from './api/subscriptions.js';
import Video from './api/video.js';
import Export from './api/export.js';
import Err from '@openaddresses/batch-error';
import * as auth from './auth.js';

export const CommandList: Record<string, keyof TAKAPI> = {
    package: 'Package',
    security: 'Security',
    profile: 'Profile',
    oauth: 'OAuth',
    locate: 'Locate',
    mission: 'Mission',
    'mission-invite': 'MissionInvite',
    'mission-log': 'MissionLog',
    'mission-layer': 'MissionLayer',
    credential: 'Credentials',
    iconsets: 'Iconsets',
    contact: 'Contacts',
    subscription: 'Subscription',
    injector: 'Injectors',
    repeater: 'Repeater',
    group: 'Group',
    video: 'Video',
    export: 'Export',
    query: 'Query',
    file: 'Files'
}

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: auth.APIAuth;
    url: URL;
    Package: Package;
    OAuth: OAuth;
    Locate: Locate;
    Security: Security;
    Iconsets: Iconsets;
    Mission: Mission;
    MissionLog: MissionLog;
    MissionInvite: MissionInvite;
    MissionLayer: MissionLayer;
    Credentials: Credentials;
    Contacts: Contacts;
    Subscription: Subscription;
    Profile: Profile;
    Injectors: Injectors;
    Repeater: Repeater;
    Group: Group;
    Video: Video;
    Export: Export;
    Query: Query;
    Files: Files;

    constructor(url: URL, auth: auth.APIAuth) {
        this.url = url;
        this.auth = auth;

        this.Query = new Query(this);
        this.Security = new Security(this);
        this.Locate = new Locate(this);
        this.Package = new Package(this);
        this.Profile = new Profile(this);
        this.OAuth = new OAuth(this);
        this.Export = new Export(this);
        this.Iconsets = new Iconsets(this);
        this.Mission = new Mission(this);
        this.MissionLog = new MissionLog(this);
        this.MissionInvite = new MissionInvite(this);
        this.MissionLayer = new MissionLayer(this);
        this.Credentials = new Credentials(this);
        this.Contacts = new Contacts(this);
        this.Subscription = new Subscription(this);
        this.Group = new Group(this);
        this.Video = new Video(this);
        this.Injectors = new Injectors(this);
        this.Repeater = new Repeater(this);
        this.Files = new Files(this);
    }

    static async init(url: URL, auth: auth.APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI(url, auth);

        await api.auth.init(api);

        return api;
    }

    stdurl(url: string | URL) {
        try {
            url = new URL(url);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            url = new URL(url, this.url);
        }

        return url;
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    async fetch(url: URL, opts: any = {}, raw=false) {
        url = this.stdurl(url);

        try {
            if (!opts.headers) opts.headers = {};

            if (
                (isPlainObject(opts.body) || Array.isArray(opts.body))
                && (
                    !opts.headers['Content-Type']
                    || opts.headers['Content-Type'].startsWith('application/json')
                )
            ) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            } else if (opts.body instanceof FormData) {
                opts.headers = opts.body.getHeaders();
            } else if (opts.body instanceof URLSearchParams) {
                opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
                opts.body = String(opts.body);
            }

            const res = await this.auth.fetch(this, url, opts)

            if (raw) return res;

            let bdy: any = {};

            if ((res.status < 200 || res.status >= 400)) {
                try {
                    bdy = await res.text();
                } catch (err) {
                    console.error(err);
                    bdy = null;
                }

                throw new Err(res.status, null, bdy || `Status Code: ${res.status}`);
            }

            if (res.headers.get('content-type') === 'application/json') {
                return await res.json();
            } else {
                return await res.text();
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'PublicError') throw err;
            throw new Err(400, null, err instanceof Error ? err.message : String(err));
        }
    }
}

function isPlainObject(value: object) {
    return  value?.constructor === Object;
}
