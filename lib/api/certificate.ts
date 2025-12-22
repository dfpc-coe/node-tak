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

    async list(
        username?: string
    ): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert', this.api.url);

        if (username) {
            url.searchParams.append('username', username);
        }

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    async listRevoked(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/revoked', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    async listReplaced(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/replaced', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    async listExpired(): Promise<Static<typeof TAKList_Certificate>> {
        const url = new URL('/Marti/api/certadmin/cert/expired', this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKList_Certificate>;
    }

    async get(
        hash: string
    ): Promise<Static<typeof TAKItem_Certificate>> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}`, this.api.url);

        return await this.api.fetch(url) as Static<typeof TAKItem_Certificate>;
    }

    async download(
        hash: string
    ): Promise<string> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}/download`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
        }) as string;
    }

    async revoke(
        hash: string
    ): Promise<Static<typeof TAKItem_Certificate>> {
        const url = new URL(`/Marti/api/certadmin/cert/${hash}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE'
        }) as Static<typeof TAKItem_Certificate>;
    }
}
