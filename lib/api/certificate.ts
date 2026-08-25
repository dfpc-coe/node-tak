import Commands from '../commands.js';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream';
import { X509Certificate } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { TAKItem, TAKList } from './types.js';

export const Certificate = Type.Object({
    id: Type.Integer(),
    creatorDn: Type.String(),
    subjectDn: Type.String(),
    userDn: Type.String(),
    certificate: Type.String(),
    hash: Type.String(),
    clientUid: Type.String(),
    issuanceDate: Type.String({ format: 'date-time' }),
    expirationDate: Type.String({ format: 'date-time' }),
    effectiveDate: Type.String({ format: 'date-time' }),
    revocationDate: Type.Optional(Type.String({ format: 'date-time' })),
    token: Type.String(),
    serialNumber: Type.String()
});

export const TAKList_Certificate = TAKList(Certificate);
export const TAKItem_Certificate = TAKItem(Certificate);

export const CertificateValidation = Type.Object({
    fingerprint: Type.String({ description: 'SHA-256 fingerprint of the DER encoded certificate - the TAK Server `hash`' }),
    subject: Type.String(),
    username: Type.String({ description: 'Common Name of the certificate subject - the TAK Server `userDn`' }),
    validFrom: Type.String(),
    validTo: Type.String(),
    expired: Type.Boolean({ description: 'validTo is in the past' }),
    known: Type.Boolean({ description: 'The TAK Server has a record for this fingerprint' }),
    revoked: Type.Boolean({ description: 'The TAK Server record carries a revocationDate' }),
    revocationDate: Type.Optional(Type.String({ format: 'date-time' })),
    valid: Type.Boolean({ description: 'Neither expired nor revoked' }),
    certificate: Type.Optional(Certificate)
});

/**
 * Extract the Common Name from an X509 subject string as reported by Node
 * (newline separated `key=value` pairs)
 */
function commonName(subject: string): string | undefined {
    for (const line of subject.split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key.trim() === 'CN') return rest.join('=').trim();
    }

    return undefined;
}

export default class CertificateCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    /**
     * List Certificates
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getAll_1 TAK Server Docs}.
     */
    async list(
        username?: string
    ): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert', this.api.url);

        if (username) {
            url.searchParams.append('username', username);
        }

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    /**
     * List Active Certificates
     *
     * The most recently issued certificate for each Client UID / User DN pair
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getActive TAK Server Docs}.
     */
    async listActive(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/active', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    /**
     * List Revoked Certificates
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getRevoked TAK Server Docs}.
     */
    async listRevoked(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/revoked', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    /**
     * List Replaced Certificates
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getReplaced TAK Server Docs}.
     */
    async listReplaced(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/replaced', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    /**
     * List Expired Certificates
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getExpired TAK Server Docs}.
     */
    async listExpired(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/expired', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    /**
     * Validate a PEM encoded client certificate against local expiry and the TAK Server revocation record
     *
     * Expiry is evaluated locally from the certificate. Revocation is looked up via the
     * Certificate Admin API using the same SHA-256 fingerprint the TAK Server `X509Authenticator`
     * consults - the certificate is matched from the user's certificate list rather than
     * `get(hash)` as the TAK Server reports an unknown hash as a 500 rather than a 404.
     *
     * Note: The TAK Server only enforces revocation when `auth.x509checkRevocation` (or
     * `x509TokenAuth`) is enabled in CoreConfig - `revoked` reports the stored state regardless
     */
    async validate(
        pem: string,
        opts: {
            now?: Date;
        } = {}
    ): Promise<Static<typeof CertificateValidation>> {
        const x509 = new X509Certificate(pem);
        const now = opts.now ?? new Date();

        const username = commonName(x509.subject);
        if (!username) throw new Error('Certificate subject does not contain a Common Name');

        const fingerprint = x509.fingerprint256.toUpperCase();

        const certificate = (await this.list(username)).data
            .find((cert) => cert.hash.toUpperCase() === fingerprint);

        const expired = Date.parse(x509.validTo) < now.getTime();
        const revoked = !!certificate?.revocationDate;

        return {
            fingerprint,
            subject: x509.subject,
            username,
            validFrom: x509.validFrom,
            validTo: x509.validTo,
            expired,
            known: !!certificate,
            revoked,
            revocationDate: certificate?.revocationDate,
            valid: !expired && !revoked,
            certificate
        };
    }

    /**
     * Get Single Certificate
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/getCertificate TAK Server Docs}.
     */
    async get(
        hash: string
    ): Promise<Static<typeof TAKItem_Certificate>> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}`, this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKItem_Certificate>;
    }

    /**
     * Download Single Certificate
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/downloadCertificate TAK Server Docs}.
     */
    async download(
        hash: string
    ): Promise<string> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}/download`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
        }) as string;
    }

    /**
     * Download Certificates by Id
     *
     * Returns a ZIP archive stream containing one `{n}_{userDn}_ClientCert.pem` entry per certificate
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/downloadCertificates TAK Server Docs}.
     */
    async downloadIds(
        ids: Array<string | number>
    ): Promise<Readable> {
        if (ids.length === 0) {
            throw new Error('At least one ID must be provided');
        }

        const url = new URL(`/Marti/api/certadmin/cert/download/${ids.map((id) => encodeURIComponent(String(id))).join(',')}`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        // The raw fetch path skips status validation - without this check a
        // TAK Server error page would be streamed as if it were the ZIP archive
        if (res.status < 200 || res.status >= 400) {
            const body = await res.text().catch(() => '');
            throw new Err(res.status, null, body || `Status Code: ${res.status}`);
        }

        return res.body;
    }

    /**
     * Revoke Single Certificate
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/revokeCertificate TAK Server Docs}.
     */
    async revoke(
        hash: string
    ): Promise<Static<typeof TAKItem_Certificate>> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE'
        }) as Static<typeof TAKItem_Certificate>;
    }

    /**
     * Revoke Certificates by Id
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/revokeCertificates TAK Server Docs}.
     */
    async revokeIds(
        ids: string[]
    ): Promise<Static<typeof TAKItem_Certificate>> {
        if (ids.length === 0) {
            throw new Error('At least one ID must be provided');
        } else if (ids.length > 1) {
            // TODO the api docs suggest this is possible but I haven't tested it yet
            throw new Error('Only one ID can be currently revoked at a time');
        }

        const url = new URL(`/Marti/api/certadmin/cert/revoke/${ids[0]}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE'
        }) as Static<typeof TAKItem_Certificate>;
    }

    /**
     * Delete Certificates by Id
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/cert-manager-admin-api/operation/deleteCertificates TAK Server Docs}.
     */
    async deleteIds(
        ids: string[]
    ): Promise<Static<typeof TAKItem_Certificate>> {
        if (ids.length === 0) {
            throw new Error('At least one ID must be provided');
        } else if (ids.length > 1) {
            // TODO the api docs suggest this is possible but I haven't tested it yet
            throw new Error('Only one ID can be currently deleted at a time');
        }

        const url = new URL(`/Marti/api/certadmin/cert/delete/${ids[0]}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE'
        }) as Static<typeof TAKItem_Certificate>;
    }
}
