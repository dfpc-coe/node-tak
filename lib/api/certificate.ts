import Commands from '../commands.js';
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
