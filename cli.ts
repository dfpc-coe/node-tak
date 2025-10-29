#!/usr/bin/env tsx

import fs from 'node:fs/promises'
import os from  'node:os';
import path from 'node:path';
import minimist from 'minimist';
import { Static } from '@sinclair/typebox';
import { CoTParser } from '@tak-ps/node-cot'
import TAK from './index.js';
import { getPemFromP12 } from 'p12-pem'
import TAKAPI, { CommandList } from './lib/api.js';
import { APIAuthPassword, APIAuthCertificate } from './lib/auth.js';
import Commands, { CommandConfig } from './lib/commands.js';
import { select, confirm, number, input, password, Separator } from '@inquirer/prompts';

const args = minimist(process.argv, {
    string: ['profile', 'format', 'auth'],
});

const configPath = path.resolve(os.homedir(), './.tak.json');
let config: Static<typeof CommandConfig>;

try {
    config = JSON.parse(String(await fs.readFile(configPath)));
} catch (err) {
    if (err instanceof Error && err.message.includes('no such file or directory')) {
        const answer = await confirm({
            message: 'No TAK Config file Detected, create one?'
        });

        if (!answer) {
            throw new Error('No config file and not creating one');
        }

        config = {
            version: 1,
            profiles: {}
        } as Static<typeof CommandConfig>;

        await fs.writeFile(
            configPath,
            JSON.stringify(config, null, 4)
        )
    } else {
        throw err;
    }
}

if (!args.profile && config.profiles && Object.keys(config.profiles).length) {
    args.profile = await select({
        message: 'Choose a profile',
        choices: [
            { name: 'New Profile', value: '' },
            new Separator(),
        ].concat(Object.keys(config.profiles).map((profile) => {
                return {
                    name: profile,
                    value: profile
                };
            }),
        )
    });
}

if (!args.profile) {
    console.error('Create new TAK Server Profile:');

    args.profile = await input({ message: 'Enter a name for this profile' });

    const host = await input({ message: 'Server hostname', default: 'ops.example.com' });

    let marti: number | undefined = 8443;
    let webtak: number | undefined = 443;
    let stream: number | undefined = 8089;

    do {
        marti = await number({ message: 'Marti API Port', default:  marti });
    } while (!marti || isNaN(marti))

    do {
        webtak = await number({ message: 'WebTAK API Port', default: webtak });
    } while (!webtak || isNaN(webtak))

    do {
        stream = await number({ message: 'Streaming Port', default: stream });
    } while (!stream || isNaN(stream))

    if (!config.profiles) config.profiles = {};
    config.profiles[args.profile] = {
        host,
        ports: { webtak, marti, stream }
    };
}

if (args.profile && !config.profiles[args.profile]) {
    throw new Error(`Profile "${args.profile}" is not defined in config file`);
} else if (!args.auth && !config.profiles[args.profile].auth) {
    const user = await input({ message: 'TAK Username' });
    const pass = await password({ message: 'TAK Password' });

    const api = await TAKAPI.init(
        new URL('https://' + config.profiles[args.profile].host + ':' + config.profiles[args.profile].ports.webtak),
        new APIAuthPassword(user, pass)
    );

    const auth = await api.Credentials.generate();
    config.profiles[args.profile].auth = {
        cert: auth.cert,
        key: auth.key,
        ca: auth.ca[0]
    }
}

let command = args._[2];

if (!command) {
    command = await select({
        message: 'Choose a Command Group',
        choices: [{
            name: 'stream',
            value: 'stream'
        }].concat(Object.keys(CommandList).map((profile) => {
            return {
                name: profile,
                value: profile
            };
        }))
    });
}

await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 4)
)


let auth = config.profiles[args.profile].auth;

if (args.auth) {
    const password = process.env.TAK_P12_PASSWORD || await input({ message: 'P12 Container Password' });

    const certs = getPemFromP12(args.auth, password)

    const cert = certs.pemCertificate
        .split('-----BEGIN CERTIFICATE-----')
        .join('-----BEGIN CERTIFICATE-----\n')
        .split('-----END CERTIFICATE-----')
        .join('\n-----END CERTIFICATE-----');

    const key = certs.pemKey
        .split('-----BEGIN RSA PRIVATE KEY-----')
        .join('-----BEGIN RSA PRIVATE KEY-----\n')
        .split('-----END RSA PRIVATE KEY-----')
        .join('\n-----END RSA PRIVATE KEY-----');

    auth = { cert, key }
}

if (!auth) throw new Error(`No Auth in ${args.profile} profile`);

if (command === 'stream') {
    const tak = await TAK.connect(
        new URL('ssl://' + config.profiles[args.profile].host + ':' + config.profiles[args.profile].ports.stream),
        auth
    );

    tak.on('cot', (cot) => {
        console.log(JSON.stringify(CoTParser.to_geojson(cot)));
    });
} else {
    if (!config.profiles[args.profile].auth) {
        throw new Error(`No Auth in ${args.profile} profile`);
    }

    const tak = new TAKAPI(
        new URL('https://' + config.profiles[args.profile].host + ':' + config.profiles[args.profile].ports.marti),
        new APIAuthCertificate(auth.cert, auth.key)
    );

    const invokeTest = tak[CommandList[command]];
    if (!invokeTest || !(invokeTest instanceof Commands)) {
        throw new Error(`${command} not found`);
    }

    const invoke = invokeTest as Commands;

    let subcommand: string | undefined = args._[3];
    const subcommands = <T extends object>(obj: T) => Object.keys(obj) as Array<keyof T>;

    if (subcommand === 'help') {
        console.log((
            [
                'Command:',
                `    tak ${command} <subcommand>`,
                'SubCommands:',
            ].concat(subcommands(invoke.schema).map((subcommand) => {
                return `    ${String(subcommand)} - ${invoke.schema[subcommand].description}`
            }))).join('\n')
        )
        
        process.exit(0);
    } else if (!subcommand) {
        subcommand = await select({
            message: 'Choose an action',
            choices: subcommands(invoke.schema).map((subcommand) => {
                return {
                    name: subcommand,
                    value: subcommand
                }
            })
        });
    }


    if (!invoke.schema[subcommand]) {
        throw new Error(`Unsupported Subcommand: ${subcommand}`);
    } else if (args.format && !invoke.schema[subcommand].formats.includes(args.format)) {
        throw new Error(`tak ${command} ${subcommand} does not support --format ${args.format}. Supported formats are: ${invoke.schema[subcommand].formats.join(",")}`);
    }

    try {
        args._[3] = subcommand;
        const res = await invoke.cli(args);

        if (typeof res === 'string') {
            console.log(res);
        } else {
            console.log(JSON.stringify(res, null, 4));
        }
    } catch (err) {
        console.error(err);
    }
}

