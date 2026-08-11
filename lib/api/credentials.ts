import { APIAuthPassword, APIAuthToken } from '../auth.js';
import { Static, Type } from '@sinclair/typebox';
import Commands, { CommandOutputFormat, type ParsedArgs } from '../commands.js';
import pem from 'pem';
import { xml2js } from '@tak-ps/xml-js';

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

    async generate(opts: {
        username?: string
    } = {}): Promise<Static<typeof CertificateResponse>> {
        let username: string;
        const headers: Record<string, string> = {
            Accept: 'application/json'
        };

        if (this.api.auth instanceof APIAuthPassword) {
            username = opts.username || this.api.auth.username;
            headers.Authorization = 'Basic ' + btoa(this.api.auth.username + ":" + this.api.auth.password);
        } else if (this.api.auth instanceof APIAuthToken) {
            // TAK Server derives the enrollment username from the token claims and requires
            // the CSR CN to match it - the caller must supply that username explicitly
            if (!opts.username) throw new Error('Token Auth requires a username for the Certificate CN');
            username = opts.username;
        } else {
            throw new Error('Must use Password or Token Auth');
        }

        const config: any = xml2js(await this.config(), { compact: true });

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
            commonName: username
        });

        const url = new URL(`/Marti/api/tls/signClient/v2`, this.api.url);
        url.searchParams.append('clientUid', username + ' (ETL)');
        url.searchParams.append('version', '3');

        const res = await this.api.fetch(url, {
            method: 'POST',
            nocookies: true,
            headers,
            body: keys.csr
        });

        let cert = '-----BEGIN CERTIFICATE-----\n' + res.signedCert;
        if (!res.signedCert.endsWith('\n')) cert = cert + '\n';
        cert = cert + '-----END CERTIFICATE-----';

        const chain = [];

        if (res.ca0) chain.push(res.ca0);
        if (res.ca1) chain.push(res.ca1);

        return {
            ca: chain,
            cert,
            key: keys.clientKey
        }
    }
}
