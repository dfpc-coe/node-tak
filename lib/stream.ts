import { Stream } from 'node:stream';

export default async function stream2buffer(stream: Stream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const _buf: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => { _buf.push(chunk); });
        stream.on("end", () => { resolve(Buffer.concat(_buf)); });
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors
        stream.on("error", (err: Error) => { reject(`error converting stream - ${err}`); });
    });
}
