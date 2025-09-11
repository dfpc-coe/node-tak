import { TAKItem } from './types.js';
import type { ParsedArgs } from 'minimist'
import { Type, Static } from '@sinclair/typebox';
import Commands, { CommandOutputFormat } from '../commands.js';

export const IsSecure = TAKItem(Type.String())
export const IsValid = TAKItem(Type.String())

export const AuthConfig = TAKItem(Type.Object({
    url: Type.String(),
    userString: Type.String(),
    updateInterval: Type.Number(),
    groupPrefix: Type.String(),
    serviceAccountDN: Type.String(),
    serviceAccountCredential: Type.String(),
    groupBaseRDN: Type.String()
}));

export const SecurityConfig = TAKItem(Type.Object({
    keystoreFile: Type.String(),
    truststoreFile: Type.String(),
    keystorePass: Type.String(),
    truststorePass: Type.String(),
    tlsVersion: Type.String(),
    x509Groups: Type.Boolean(),
    x509addAnon: Type.Boolean(),
    enableEnrollment: Type.Boolean(),
    caType: Type.String(),
    signingKeystoreFile: Type.String(),
    signingKeystorePass: Type.String(),
    validityDays: Type.Number(),
    mscaUserName: Type.Union([Type.String(), Type.Null()]),
    mscaPassword: Type.Union([Type.String(), Type.Null()]),
    mscaTruststore: Type.Union([Type.String(), Type.Null()]),
    mscaTruststorePass: Type.Union([Type.String(), Type.Null()]),
    mscaTemplateName: Type.Union([Type.String(), Type.Null()]),
}));

export default class SecurityAuthenticationCommands extends Commands {
    schema = {
        'security-config': {
            description: 'security-config',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'auth-config': {
            description: 'auth-config',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'verify-config': {
            description: 'verify-config',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'is-secure': {
            description: 'is-secure',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'security-config') {
            return await this.securityConfig();
        } else if (args._[3] === 'auth-config') {
            return  await this.authConfig();
        } else if (args._[3] === 'verify-config') {
            return  await this.verifyConfig();
        } else if (args._[3] === 'is-secure') {
            return  await this.isSecure();
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    /**
     * Get Security Configuration
     *
     * {@link https://docs.tak.gov/api/takserver#tag/security-authentication-api/operation/getSecConfig TAK Server Docs}.
     */
    async securityConfig(): Promise<Static<typeof SecurityConfig>> {
        const url = new URL('/Marti/api/security/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get Auth Configuration
     *
     * {@link https://docs.tak.gov/api/takserver#tag/security-authentication-api/operation/getAuthConfig TAK Server Docs}.
     */
    async authConfig(): Promise<Static<typeof AuthConfig>> {
        const url = new URL('/Marti/api/authentication/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Verify Configuration
     *
     * {@link https://docs.tak.gov/api/takserver#tag/security-authentication-api/operation/verifyConfig TAK Server Docs}.
     */
    async verifyConfig(): Promise<Static<typeof IsValid>> {
        const url = new URL('/Marti/api/security/verifyConfig', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Is Secure
     *
     * {@link https://docs.tak.gov/api/takserver#tag/security-authentication-api/operation/isSecure TAK Server Docs}.
     */
    async isSecure(): Promise<Static<typeof IsSecure>> {
        const url = new URL('/Marti/api/security/isSecure', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
