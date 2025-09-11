import { TAKList } from './types.js';
import type { ParsedArgs } from 'minimist'
import { Type, Static } from '@sinclair/typebox';
import Commands, { CommandOutputFormat } from '../commands.js';

export const Injector = Type.Object({
    uid: Type.String(),
    toInject: Type.String()
})

export const TAKList_Injector = TAKList(Injector);

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
    async securityConfig(): Promise<Static<typeof TAKList_Injector>> {
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
    async securityConfig(): Promise<Static<typeof TAKList_Injector>> {
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
    async verifyConfig(): Promise<Static<typeof TAKList_Injector>> {
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
    async isSecure(): Promise<Static<typeof TAKList_Injector>> {
        const url = new URL('/Marti/api/security/isSecure', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
