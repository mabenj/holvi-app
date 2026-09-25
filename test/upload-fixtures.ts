import { IncomingMessage } from "http";
import sharp from "sharp";
import { Readable } from "stream";

export interface UploadPart {
    name: string;
    content: Buffer;
    mimeType: string;
    /** The browser-reported last-modified time, sent as the part's field name as the app's client does */
    lastModified: Date;
}

/** A small solid-colour PNG, generated at test time */
export function pngImage(colour = "#3366cc") {
    return sharp({
        create: { width: 32, height: 24, channels: 3, background: colour }
    })
        .png()
        .toBuffer();
}

/** A multipart upload request carrying the given files, the way the app's client sends them */
export function uploadRequest(parts: UploadPart[]): IncomingMessage {
    const boundary = "----holvi-test-boundary";
    const chunks: Buffer[] = [];
    for (const part of parts) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="${part.lastModified.getTime()}"; filename="${part.name}"\r\n` +
                    `Content-Type: ${part.mimeType}\r\n\r\n`
            ),
            part.content,
            Buffer.from("\r\n")
        );
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);

    const request = Readable.from([body]) as Readable & {
        headers: IncomingMessage["headers"];
    };
    request.headers = {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(body.length)
    };
    return request as unknown as IncomingMessage;
}
