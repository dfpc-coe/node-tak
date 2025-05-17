<h1 align=center>Node-TAK</h1>
<p align=center>Javascript TAK Server Library</p>

Lightweight JavaScript library for managing TAK TLS connections for streaming CoT data
as well as a typed SDK for performing TAK Server REST API operations

## API Documentation

API Documentation for the latest version can be found on our [Github Pages Site](https://dfpc-coe.github.io/node-tak/)

Or generated locally with

```sh
npm run doc

```

## Installation

### NPM

To install `node-tak` with npm run

```bash
npm install @tak-ps/node-tak
```

or for use with the global CLI:

```bash
npm install --global @tak-ps/node-tak
```

## CLI Usage Examples

### Initial Setup

The initial run of the CLI will generate a new Connection Profile & Credentials

```
tak
```

Once the profile is generated you can specify it with `--profile <profile>` in any command
or if it is not provided it will be interactively requested

### Streaming COTs

```
tak stream
```

### API Operations

```
tak <command> <subcommand>
tak mission list
tak package list
```

etc.

## SDK Usage Examples

### Basic Streaming COT Usage

```js
import TAK from '@tak-ps/node-tak';

const tak = await TAK.connect('ConnectionID', new URL('https://tak-server.com:8089'), {
    key: conn.auth.key,
    cert: conn.auth.cert
});

tak.on('cot', async (cot: CoT) => {
    console.error('COT', cot); // See node-cot library
}).on('end', async () => {
    console.error(`Connection End`);
}).on('timeout', async () => {
    console.error(`Connection Timeout`);
}).on('ping', async () => {
    console.error(`TAK Server Ping`);
}).on('error', async (err) => {
    console.error(`Connection Error`);
});

```

### Basic API Usage

```js
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak'

const api = await TAKAPI.init(new URL('TAK SERVER Marti API & Port'), new APIAuthCertificate(auth.cert, auth.key));

const missions = await api.Mission.list(req.query);

console.error(missions);
```
