import { APIAuthPassword } from '../auth.js';
import type { ParsedArgs } from 'minimist'
import { Static, Type } from '@sinclair/typebox';
import Commands, { CommandOutputFormat } from '../commands.js';
import pem from 'pem';
import xmljs from 'xml-js';

export const CertificateResponse = Type.Object({
    ca: Type.Array(Type.String()),
    cert: Type.String(),
    key: Type.String()
});

export default class CredentialCommands extends Commands {
    schema = {
        config: {
            description: 'Return TLS Config Info',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'config') {
            return this.config();
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async config(): Promise<string> {
        const url = new URL(`/Marti/api/tls/config`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async generate(): Promise<Static<typeof CertificateResponse>> {
        if (!(this.api.auth instanceof APIAuthPassword)) throw new Error('Must use Password Auth');

        const config: any = xmljs.xml2js(await this.config(), { compact: true });

        let organization = null;
        let organizationUnit = null;
        const nameEntries = config['ns2:certificateConfig'].nameEntries;
        if (nameEntries && nameEntries.nameEntry) {
            for (const ne of nameEntries.nameEntry) {
                if (ne._attributes && ne._attributes.name === 'O') organization = ne._attributes.value;
                if (ne._attributes && ne._attributes.name === 'OU') organizationUnit = ne._attributes.value;
            }
        }

        const createCSR = pem.promisified.createCSR;

        const keys: {
            csr: string,
            clientKey: string
        } = await createCSR({
            organization,
            organizationUnit,
            commonName: this.api.auth.username
        });

        const url = new URL(`/Marti/api/tls/signClient/v2`, this.api.url);
        url.searchParams.append('clientUid', this.api.auth.username + ' (ETL)');
        url.searchParams.append('version', '3');

        const res = await this.api.fetch(url, {
            method: 'POST',
            nocookies: true,
            headers: {
                Accept: 'application/json',
                Authorization: 'Basic ' + btoa(this.api.auth.username + ":" + this.api.auth.password)
            },
            body: keys.csr
        });

        let cert = '-----BEGIN CERTIFICATE-----\n' + res.signedCert;
        if (!res.signedCert.endsWith('\n')) cert = cert + '\n';
        cert = cert + '-----END CERTIFICATE-----';

        return {
            ca: [ res.ca0 ],
            cert,
            key: keys.clientKey
        }
    }
}
