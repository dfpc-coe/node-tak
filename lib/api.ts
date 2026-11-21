import OAuth from './api/oauth.js';
import PackageCommands from './api/package.js';
import CertificateCommands from './api/certificate.js';
import Query from './api/query.js';
import Locate from './api/locate.js';
import MissionCommands, { MissionSubscriberRole } from './api/mission.js';
import MissionInviteCommands, { MissionInviteType } from './api/mission-invite.js';
import MissionLogCommands from './api/mission-log.js';
import MissionPropertyCommands from './api/mission-property.js';
import MissionLayerCommands, { MissionLayerType } from './api/mission-layer.js';
import Credentials from './api/credentials.js';
import Security from './api/security.js';
import Contacts from './api/contacts.js';
import Client from './api/client.js';
import Profile from './api/profile.js';
import Files from './api/files.js';
import Iconsets from './api/iconsets.js';
import Injectors from './api/injectors.js';
import RepeaterCommands from './api/repeater.js';
import GroupCommands from './api/groups.js';
import SubscriptionCommands from './api/subscriptions.js';
import Video from './api/video.js';
import Export from './api/export.js';
import UserManagement from './api/user-management.js';
import Err from '@openaddresses/batch-error';
import { TAKServerError, isHTML } from './utils/html-error.js';
import * as auth from './auth.js';
import { typed } from './utils/typed.js';

type ErrorWithCause = Error & {
    code?: unknown;
    cause?: unknown;
};

type FetchOptions = {
    headers?: Record<string, string | undefined>;
    body?: unknown;
};

type FetchResponse = {
    status: number;
    headers: { get: (name: string) => unknown };
    text: () => Promise<string>;
    json: () => Promise<unknown>;
};

function formatFetchError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);

    const root = err as ErrorWithCause;

    const messages = new Set<string>();

    const push = (value: unknown) => {
        if (value === undefined || value === null || value === false || value === 0) return;

        // oxlint-disable-next-line typescript/no-base-to-string
        const message = String(value).trim();

        if (!message || message === 'fetch failed') return;

        messages.add(message);
    };

    push(root.code);
    push(root.message);

    let cause: unknown = root.cause;
    while (cause !== undefined && cause !== null) {
        if (cause instanceof Error) {
            const nested = cause as ErrorWithCause;
            push(nested.code);
            push(nested.message);
            cause = nested.cause;
        } else {
            push(cause);
            break;
        }
    }

    if (messages.size > 0) return Array.from(messages).join(': ');
    return root.message;
}

export const CommandList: Record<string, keyof TAKAPI> = {
    package: 'Package',
    security: 'Security',
    profile: 'Profile',
    oauth: 'OAuth',
    locate: 'Locate',
    mission: 'Mission',
    'mission-invite': 'MissionInvite',
    'mission-log': 'MissionLog',
    'mission-property': 'MissionProperty',
    'mission-layer': 'MissionLayer',
    credential: 'Credentials',
    certificate: 'Certificate',
    iconsets: 'Iconsets',
    contact: 'Contacts',
    client: 'Client',
    subscription: 'Subscription',
    injector: 'Injectors',
    repeater: 'Repeater',
    group: 'Group',
    video: 'Video',
    export: 'Export',
    query: 'Query',
    file: 'Files',
    'user-management': 'UserManagement'
}

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: auth.APIAuth;
    url: URL;
    Package: PackageCommands;
    OAuth: OAuth;
    Locate: Locate;
    Security: Security;
    Iconsets: Iconsets;
    Mission: MissionCommands;
    MissionLog: MissionLogCommands;
    MissionProperty: MissionPropertyCommands;
    MissionInvite: MissionInviteCommands;
    MissionLayer: MissionLayerCommands;
    Credentials: Credentials;
    Client: Client;
    Contacts: Contacts;
    Certificate: CertificateCommands;
    Subscription: SubscriptionCommands;
    Profile: Profile;
    Injectors: Injectors;
    Repeater: RepeaterCommands;
    Group: GroupCommands;
    Video: Video;
    Export: Export;
    Query: Query;
    Files: Files;
    UserManagement: UserManagement;

    constructor(url: URL, auth: auth.APIAuth) {
        this.url = url;
        this.auth = auth;

        this.Query = new Query(this);
        this.Security = new Security(this);
        this.Locate = new Locate(this);
        this.Package = new PackageCommands(this);
        this.Profile = new Profile(this);
        this.Certificate = new CertificateCommands(this);
        this.OAuth = new OAuth(this);
        this.Export = new Export(this);
        this.Iconsets = new Iconsets(this);
        this.Mission = new MissionCommands(this);
        this.MissionLog = new MissionLogCommands(this);
        this.MissionProperty = new MissionPropertyCommands(this);
        this.MissionInvite = new MissionInviteCommands(this);
        this.MissionLayer = new MissionLayerCommands(this);
        this.Client = new Client(this);
        this.Credentials = new Credentials(this);
        this.Contacts = new Contacts(this);
        this.Subscription = new SubscriptionCommands(this);
        this.Group = new GroupCommands(this);
        this.Video = new Video(this);
        this.Injectors = new Injectors(this);
        this.Repeater = new RepeaterCommands(this);
        this.Files = new Files(this);
        this.UserManagement = new UserManagement(this);
    }

    static async init(url: URL, auth: auth.APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI(url, auth);

        await api.auth.init(api);

        return api;
    }

    stdurl(url: string | URL) {
        try {
            url = new URL(url);
        } catch {
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
    // oxlint-disable-next-line typescript/no-explicit-any
    async fetch(url: URL, opts: any = {}, raw=false): Promise<any> {
        url = this.stdurl(url);

        const req = typed<FetchOptions>(opts);

        try {
            req.headers ??= {};
            const headers = req.headers;

            if (
                (isPlainObject(req.body) || Array.isArray(req.body))
                && (
                    !headers['Content-Type']
                    || headers['Content-Type'].startsWith('application/json')
                )
            ) {
                req.body = JSON.stringify(req.body);
                headers['Content-Type'] = 'application/json';
            } else if (typeof FormData !== 'undefined' && req.body instanceof FormData) {
                // Let fetch/undici set multipart headers and boundary automatically.
                delete headers['Content-Type'];
            } else if (req.body instanceof URLSearchParams) {
                headers['Content-Type'] = 'application/x-www-form-urlencoded'
                req.body = String(req.body);
            }

            const res = typed<FetchResponse>(await this.auth.fetch(this, url, req));

            if (raw) return res;

            let bdy: string | null;

            if ((res.status < 200 || res.status >= 400)) {
                try {
                    bdy = await res.text();
                } catch (err) {
                    console.error(err);
                    bdy = null;
                }

                const message = bdy || `Status Code: ${res.status}`;

                // TAK Server returns HTML error pages
                if (isHTML(bdy)) throw new TAKServerError(res.status, bdy);

                throw new Err(res.status, null, message);
            }

            if (res.headers.get('content-type') === 'application/json') {
                return await res.json();
            }

            return await res.text();
        } catch (err) {
            if (err instanceof Err) throw err;
            throw new Err(400, null, formatFetchError(err));
        }
    }
}

function isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && value?.constructor === Object;
}

export {
    OAuth,
    PackageCommands as Package,
    CertificateCommands as Certificate,
    Query,
    Locate,
    MissionCommands as Mission,
    MissionInviteCommands as MissionInvite,
    MissionLogCommands as MissionLog,
    MissionPropertyCommands as MissionProperty,
    MissionLayerCommands as MissionLayer,
    Client,
    Credentials,
    Security,
    Contacts,
    Profile,
    Files,
    Iconsets,
    Injectors,
    RepeaterCommands as Repeater,
    GroupCommands as Group,
    SubscriptionCommands as Subscription,
    Video,
    Export,
    UserManagement,
    MissionSubscriberRole,
    MissionLayerType,
    MissionInviteType
};
