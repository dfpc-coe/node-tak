<h1 align=center>Node-TAK</h1>

<p align=center>Javascript TAK Server Library</p>

Lightweight JavaScript library for managing TAK TLS connections for streaming CoT data

## Installation

### NPM

To install `node-tak` with npm run

```bash
npm install @tak-ps/node-tak
```

## Usage Examples

### Basic Usage

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
