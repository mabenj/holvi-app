// The sample files the scenario plan puts into collections, by key: each
// file's name and type, and how to make its content when the seed uploads it

import sharp from "sharp";

/**
 * @typedef {{ name: string, mimeType: string, content: () => Promise<Buffer> }} SampleFile
 * @type {Record<string, SampleFile>}
 */
export const MEDIA = {
    /** A generated sunset: a sky gradient, a sun and a horizon */
    sunset: {
        name: "sunset.jpg",
        mimeType: "image/jpeg",
        content: () =>
            sharp(Buffer.from(sunsetSvg(1600, 1067)))
                .jpeg({ quality: 85 })
                .toBuffer()
    }
};

function sunsetSvg(width, height) {
    const horizon = Math.round(height * 0.68);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#1d2b64"/>
                <stop offset="0.55" stop-color="#c0527a"/>
                <stop offset="1" stop-color="#f8b26a"/>
            </linearGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2d3a6b"/>
                <stop offset="1" stop-color="#0d1330"/>
            </linearGradient>
        </defs>
        <rect width="${width}" height="${horizon}" fill="url(#sky)"/>
        <circle cx="${width * 0.62}" cy="${horizon}" r="${height * 0.14}" fill="#ffd27a"/>
        <rect y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#sea)"/>
    </svg>`;
}
