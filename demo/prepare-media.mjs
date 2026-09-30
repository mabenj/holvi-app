// Prepares the demo environment's sample media in demo/media from CC0 originals
// on Wikimedia Commons, and writes demo/media/SOURCES.md to record them.
//
//     node demo/prepare-media.mjs
//
// Needs network access and the repo's dependencies (yarn install). Nothing is
// cached on disk: each original is downloaded into memory and only the
// prepared file is written. The prepared files are committed, so this only
// needs running again to change the set.
//
// Every file's licence is checked on its Commons file page first, and the
// script stops if one is not CC0 or public domain.

import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { promisify } from "util";

const run = promisify(execFile);

const MEDIA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "media");
/** Commons asks every client for a descriptive User-Agent */
const USER_AGENT =
    "HolviDemoMediaPrep/1.0 (sample media for the demo environment of the Holvi app; markobenjar@gmail.com)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Photos are downscaled so their long edge is at most this, in pixels */
const PHOTO_LONG_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 80;
const CLIP_SECONDS = 3;

/**
 * The photos. `takenAt` is written as the EXIF taken date (DateTimeOriginal),
 * a camera's local time without a time zone. It is the date the file page
 * gives, with a made-up time of day where the page gives none. `gps` is
 * written as EXIF GPS; it comes from the file page's location template unless
 * `gpsNote` says otherwise. Photos without `gps` deliberately have none.
 */
const PHOTOS = [
    { name: "paella.jpg", title: "File:Cooking a paella.jpg", takenAt: "2010-08-04 13:30:00" },
    { name: "buche-de-noel.jpg", title: "File:Bûche de Noël chocolat framboise maison.jpg", takenAt: "2011-12-24 19:00:00" },
    { name: "chain-bridge-budapest-night.jpg", title: "File:Széchenyi Chain Bridge in Budapest at night.jpg", takenAt: "2013-06-20 22:47:56", gps: [47.496397, 19.040615] },
    { name: "flamingos-sao-paulo-zoo.jpg", title: "File:Phoenicopterus ruber in São Paulo Zoo.jpg", takenAt: "2014-08-16 12:21:16", gps: [-23.6505, -46.6197], gpsNote: "approximate: São Paulo Zoo; the file page has no location" },
    { name: "beach-parasols-evening.jpg", title: "File:Parasols, Evening, Beach, Rincon de la Victoria, Andalusia, Spain.jpg", takenAt: "2014-07-31 20:15:00", gps: [36.713674, -4.275868] },
    { name: "water-lily-alhambra.jpg", title: "File:Nymphaea alba, Alhambra, Granada, Spain.jpg", takenAt: "2014-08-06 11:00:00", gps: [37.176911, -3.588466] },
    { name: "aegina-sunset.jpg", title: "File:Aegina sunset.jpg", takenAt: "2015-10-27 16:40:28", gps: [37.745142, 23.426711] },
    { name: "aegina-harbour-night.jpg", title: "File:Night view chapel harbour Aegina Greece.jpg", takenAt: "2015-10-27 19:30:00" },
    { name: "cat-asleep-on-bench.jpg", title: "File:Chat domestique dormant sur un banc.jpg", takenAt: "2016-07-30 15:57:00" },
    { name: "dog-on-beach.jpg", title: "File:Dog at Nørre Vorupør Strand.jpg", takenAt: "2017-04-14 15:31:48", gps: [56.95923, 8.365443] },
    { name: "beach-steps.jpg", title: "File:Wooden steps at Nørre Vorupør Strand.jpg", takenAt: "2017-04-14 15:57:00" },
    { name: "beech-and-ferns.jpg", title: "File:Beech and ferns in Gullmarsskogen.jpg", takenAt: "2017-06-09 13:43:44" },
    { name: "spruce-forest.jpg", title: "File:Spruce forest at Holma.jpg", takenAt: "2017-06-09 19:11:12", gps: [58.384771, 11.558511] },
    { name: "rose-hips.jpg", title: "File:Rose hips in autumn.jpg", takenAt: "2017-10-06 12:56:41" },
    { name: "tabby-cat.jpg", title: "File:Young tabby cat keeping watch.jpg", takenAt: "2018-06-11 20:31:06" },
    { name: "horseshoe-falls.jpg", title: "File:Horseshoe-Falls-Zoom.jpg", takenAt: "2018-09-28 17:14:10", gps: [43.0788664, -79.078299] },
    { name: "labrador.jpg", title: "File:Portrait of a labrador retriever.jpg", takenAt: "2019-07-20 18:17:36" },
    { name: "waterfall-glandieu.jpg", title: "File:Cascade de Glandieu, octobre 2019 (1).jpg", takenAt: "2019-10-07 17:42:50" },
    { name: "snowy-trees.jpg", title: "File:Lots of trees with snow.jpg", takenAt: "2021-01-17 08:52:19" },
    { name: "marigolds.jpg", title: "File:Tagetes2.jpg", takenAt: "2022-07-09 12:07:59" },
    { name: "rio-sugarloaf-sunset.jpg", title: "File:Rio de Janeiro skyline and Sugarloaf Mountain at sunset, Brazil 3.jpg", takenAt: "2023-06-03 14:08:17" },
    { name: "lake-khovsgol.jpg", title: "File:Lake Khövsgöl, Mongolia.jpg", takenAt: "2023-06-27 16:00:00", gps: [50.535889, 100.391861] },
    { name: "lake-terkhiin-tsagaan.jpg", title: "File:Terkhiin Tsagaan Lake 01.jpg", takenAt: "2023-06-30 10:30:00", gps: [48.166333, 99.76375] },
    { name: "quebec-snow-fog.jpg", title: "File:Snow-covered Quebec City skyline in fog.jpg", takenAt: "2023-12-06 10:27:17" },
    { name: "quebec-autumn.jpg", title: "File:Autumn in Quebec City (in autumn 02).jpg", takenAt: "2024-10-20 17:04:01" },
    { name: "go-away-bird.jpg", title: "File:White-bellied go-away-bird (Corythaixoides leucogaster).jpg", takenAt: "2025-01-18 12:35:53" },
    { name: "monschau-autumn.jpg", title: "File:Along the Rur, autumn in Monschau, 2025.jpg", takenAt: "2025-10-18 14:11:14", gps: [50.554374, 6.241492] },
    { name: "red-fox-in-snow.jpg", title: "File:Red fox in yard, Charlton MA 2025-12-26.jpg", takenAt: "2025-12-26 13:04:38" }
];

/**
 * The video clips, each cut to CLIP_SECONDS from `startSeconds` and made
 * twice: as H.264 with AAC audio in MP4 (web-safe) and as HEVC with AAC audio
 * in MOV, tagged the way Apple devices do (not web-safe, so video processing
 * gives it a Rendition). `creationTime` is written as the creation_time
 * metadata, which video processing reads as when the video was shot: the date
 * the file page gives, with a made-up time of day.
 */
const CLIPS = [
    { name: "sea-foam", title: "File:Sea Foam off Amphitrite Point near Ucluelet.webm", startSeconds: 8, creationTime: "2015-08-25T18:42:10Z" },
    { name: "loons", title: "File:Loons Swimming in Wood Lake BC on a Summer Morning.webm", startSeconds: 4, creationTime: "2015-08-03T14:05:30Z" },
    { name: "waterfall-vertical", title: "File:Watagataki Falls (Video).webm", startSeconds: 3, creationTime: "2025-11-12T03:20:45Z" }
];

/**
 * The broken video: an H.264/AAC MP4 cut from one of the clips whose audio
 * track is then made unreadable, by changing its codec (the sample entry's
 * fourcc and the decoder config's object type) to one no decoder knows.
 * Upload accepts it, because reading its metadata and taking its thumbnail
 * only need the video track. Video processing fails on it: the audio is not
 * AAC, so it is not web-safe, and making its Rendition needs the audio
 * decoded, which ffmpeg cannot do.
 */
const BROKEN = {
    name: "broken-audio.mp4",
    title: "File:Loons Swimming in Wood Lake BC on a Summer Morning.webm",
    startSeconds: 20,
    creationTime: "2015-08-03T14:12:00Z"
};

async function main() {
    const titles = [...new Set([...PHOTOS, ...CLIPS, BROKEN].map((file) => file.title))];
    const pages = await fetchFilePages(titles);

    await rm(MEDIA_DIR, { recursive: true, force: true });
    await mkdir(MEDIA_DIR, { recursive: true });

    for (const photo of PHOTOS) {
        console.log(`Photo ${photo.name}`);
        await preparePhoto(photo, pages.get(photo.title));
    }
    for (const clip of CLIPS) {
        console.log(`Clip ${clip.name}`);
        await prepareClip(clip, pages.get(clip.title));
    }
    console.log(`Broken video ${BROKEN.name}`);
    await prepareBroken(BROKEN, pages.get(BROKEN.title));

    await writeSources(pages);
    const names = await readdir(MEDIA_DIR);
    let total = 0;
    for (const name of names) {
        total += (await stat(path.join(MEDIA_DIR, name))).size;
    }
    console.log(`${names.length} files, ${(total / 1024 / 1024).toFixed(1)} MiB in ${MEDIA_DIR}`);
}

/**
 * Reads each file's page from Commons: its download URL, author and licence,
 * and the licence templates in its wikitext. Stops unless the page licenses
 * the file as CC0 or public domain.
 */
async function fetchFilePages(titles) {
    const pages = new Map();
    const BATCH = 20;
    for (let i = 0; i < titles.length; i += BATCH) {
        const batch = titles.slice(i, i + BATCH).join("|");
        const [info, wikitext] = await Promise.all([
            commonsQuery({ prop: "imageinfo", iiprop: "extmetadata|url|size|mime", titles: batch }),
            commonsQuery({ prop: "revisions", rvprop: "content", rvslots: "main", titles: batch })
        ]);
        for (const page of info.query.pages) {
            if (page.missing) {
                throw new Error(`${page.title} does not exist on Commons`);
            }
            const imageinfo = page.imageinfo[0];
            const meta = imageinfo.extmetadata;
            const text = wikitext.query.pages.find((p) => p.title === page.title).revisions[0].slots.main.content;
            const licenceTemplates = [...text.matchAll(/\{\{\s*((?:self\s*\|\s*)?(?:cc-zero|pd-[^}|]*|public domain[^}|]*))\s*\}\}/gi)].map(
                (match) => `{{${match[1]}}}`
            );
            const licence = meta.LicenseShortName?.value ?? "";
            if (!/^(CC0|Public domain)$/i.test(licence) || licenceTemplates.length === 0) {
                throw new Error(`${page.title} is not CC0 or public domain on its file page (licence '${licence}')`);
            }
            pages.set(page.title, {
                title: page.title,
                pageUrl: imageinfo.descriptionurl,
                downloadUrl: imageinfo.url,
                width: imageinfo.width,
                height: imageinfo.height,
                author: stripHtml(meta.Artist?.value),
                credit: stripHtml(meta.Credit?.value),
                date: stripHtml(meta.DateTimeOriginal?.value),
                licence,
                licenceUrl: meta.LicenseUrl?.value ?? "",
                licenceTemplates
            });
        }
    }
    return pages;
}

async function commonsQuery(params) {
    const url = `${COMMONS_API}?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params })}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
        throw new Error(`Commons API responded ${response.status} for ${url}`);
    }
    return response.json();
}

async function download(url) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
        throw new Error(`Download responded ${response.status} for ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

/**
 * Downscales a photo to a JPEG and writes EXIF chosen for the demo in place of
 * the original's: the taken date, GPS for some, and the author and licence.
 */
async function preparePhoto(photo, page) {
    const original = await download(page.downloadUrl);
    // Decoded to raw pixels first, so none of the original's metadata survives;
    // the default pipeline converts the pixels to sRGB and applies the orientation
    const { data, info } = await sharp(original)
        .rotate()
        .resize({ width: PHOTO_LONG_EDGE, height: PHOTO_LONG_EDGE, fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const exifDate = photo.takenAt.replace(/-/g, ":");
    const exif = {
        IFD0: {
            Artist: asciiOnly(page.author),
            Copyright: `${page.licence} (${page.pageUrl})`,
            Software: "holvi demo/prepare-media.mjs"
        },
        IFD2: { DateTimeOriginal: exifDate, DateTimeDigitized: exifDate },
        ...(photo.gps ? { IFD3: gpsIfd(photo.gps) } : {})
    };
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .jpeg({ quality: PHOTO_JPEG_QUALITY, mozjpeg: true })
        .withMetadata({ exif })
        .toFile(path.join(MEDIA_DIR, photo.name));
}

/** EXIF GPS fields for decimal degrees, as libvips writes them from strings */
function gpsIfd([latitude, longitude]) {
    return {
        GPSLatitudeRef: latitude < 0 ? "S" : "N",
        GPSLatitude: degreesMinutesSeconds(latitude),
        GPSLongitudeRef: longitude < 0 ? "W" : "E",
        GPSLongitude: degreesMinutesSeconds(longitude)
    };
}

/** Rational degrees, minutes and thousandths of seconds, such as "22/1 56/1 57210/1000" */
function degreesMinutesSeconds(decimal) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = Math.round(((absolute - degrees) * 60 - minutes) * 60 * 1000);
    return `${degrees}/1 ${minutes}/1 ${seconds}/1000`;
}

async function prepareClip(clip, page) {
    await encodeClip(clip, page, "mp4", path.join(MEDIA_DIR, `${clip.name}.mp4`));
    await encodeClip(clip, page, "mov", path.join(MEDIA_DIR, `${clip.name}.mov`));
}

/**
 * Cuts a clip straight from the original's URL (ffmpeg seeks with range
 * requests, so only the part it needs is downloaded) and encodes it as H.264
 * in MP4 or HEVC in MOV, both with AAC audio.
 */
async function encodeClip(clip, page, container, target) {
    const video =
        container === "mp4"
            ? ["-c:v", "libx264", "-preset", "slow", "-crf", "26", "-profile:v", "high", "-movflags", "+faststart"]
            : // Tagged the way Apple devices tag HEVC
              ["-c:v", "libx265", "-preset", "medium", "-crf", "30", "-tag:v", "hvc1", "-x265-params", "log-level=error"];
    await ffmpeg([
        ...["-ss", String(clip.startSeconds), "-user_agent", USER_AGENT, "-i", page.downloadUrl],
        ...["-t", String(CLIP_SECONDS)],
        // The first video and audio streams, without the original's metadata
        ...["-map", "0:v:0", "-map", "0:a:0", "-map_metadata", "-1"],
        ...video,
        ...["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ac", "2"],
        ...["-metadata", `creation_time=${clip.creationTime}`],
        ...["-f", container, target]
    ]);
}

async function prepareBroken(broken, page) {
    const target = path.join(MEDIA_DIR, broken.name);
    await encodeClip(broken, page, "mp4", target);
    const content = await readFile(target);
    breakAudioCodec(content);
    await writeFile(target, content);
}

const UNKNOWN_FOURCC = "xxxx";
/** An MPEG-4 object type no decoder is registered for */
const UNKNOWN_OBJECT_TYPE = 0xfe;

/**
 * Changes an MP4's AAC audio track to an unknown codec in place: the sample
 * entry's fourcc (mp4a) and the object type in its decoder config (esds).
 */
function breakAudioCodec(content) {
    const find = (text, from = 0) => {
        const at = content.indexOf(Buffer.from(text, "latin1"), from);
        if (at < 0) {
            throw new Error(`No '${text}' box in the broken video`);
        }
        return at;
    };
    const sampleEntry = find("mp4a", find("stsd", find("soun")));
    content.write(UNKNOWN_FOURCC, sampleEntry, "latin1");
    // After the box type and its version and flags: the ES descriptor, then the decoder config descriptor
    let offset = find("esds", sampleEntry) + 8;
    offset = skipDescriptorHeader(content, offset, 0x03);
    const esFlags = content[offset + 2];
    if (esFlags !== 0) {
        throw new Error("The ES descriptor has optional fields this script does not skip");
    }
    offset = skipDescriptorHeader(content, offset + 3, 0x04);
    if (content[offset] !== 0x40) {
        throw new Error("The audio track is not AAC");
    }
    content[offset] = UNKNOWN_OBJECT_TYPE;
}

/** Skips an MPEG-4 descriptor's tag and its 1–4 byte length */
function skipDescriptorHeader(content, offset, tag) {
    if (content[offset] !== tag) {
        throw new Error(`Expected descriptor tag ${tag} in the broken video`);
    }
    let length = 1;
    while (content[offset + length] & 0x80 && length < 4) {
        length++;
    }
    return offset + 1 + length;
}

async function ffmpeg(args) {
    await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 16 * 1024 * 1024 });
}

async function probe(file) {
    const { stdout } = await run(ffprobe.path, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
    return JSON.parse(stdout);
}

async function writeSources(pages) {
    const sizeOf = async (name) => `${((await stat(path.join(MEDIA_DIR, name))).size / 1024).toFixed(0)} KiB`;
    const source = (page) =>
        `[${page.title.replace(/^File:/, "")}](${page.pageUrl}) by ${page.author} (${page.credit}), licence ${page.licence} (${page.licenceTemplates.join(", ")} on the file page)`;
    const lines = [
        "# Sample media sources",
        "",
        "The demo environment's sample media. Every file is prepared from an original on",
        "Wikimedia Commons whose file page licenses it as CC0, the Creative Commons public",
        "domain dedication (https://creativecommons.org/publicdomain/zero/1.0/). Each row",
        "links the file page, which is where its licence is stated.",
        "`demo/prepare-media.mjs` checks the licence on each file page (its licence",
        "templates and the licence Commons reports for it) before it prepares anything,",
        "downloads the originals and writes these files. Run it again to reproduce them:",
        "`node demo/prepare-media.mjs`.",
        "",
        `Licences last checked: ${new Date().toISOString().slice(0, 10)}.`,
        "",
        "## Photos",
        "",
        `Each original was downscaled once to at most ${PHOTO_LONG_EDGE} px on the long edge (after applying its`,
        `EXIF orientation), converted to sRGB and saved as JPEG at quality ${PHOTO_JPEG_QUALITY} (mozjpeg). All of`,
        "the original's metadata was removed. The EXIF written in its place is chosen for the",
        "demo, not the camera's: the taken date (DateTimeOriginal and DateTimeDigitized, which",
        "have no time zone; Holvi reads them as UTC) is the date on the file page, with a made-up time of day",
        "where the page gives none; GPS, on some photos only, is the location on the file",
        "page unless noted; Artist is the author and Copyright the licence and file page.",
        "",
        "| File | Size | Taken date written | GPS written | Source |",
        "| --- | --- | --- | --- | --- |"
    ];
    for (const photo of PHOTOS) {
        const gps = photo.gps
            ? `${photo.gps[0]}, ${photo.gps[1]}${photo.gpsNote ? ` (${photo.gpsNote})` : ""}`
            : "none";
        lines.push(`| ${photo.name} | ${await sizeOf(photo.name)} | ${photo.takenAt} | ${gps} | ${source(pages.get(photo.title))} |`);
    }
    lines.push(
        "",
        "## Videos",
        "",
        `Each clip is ${CLIP_SECONDS} seconds cut from the original, from the start time given,`,
        "at the original's resolution and frame rate, without the original's metadata. It is",
        "encoded twice, with its creation_time metadata set to the date on the file page and",
        "a made-up time of day:",
        "",
        "- `.mp4`: H.264 (High profile, yuv420p, CRF 26) with AAC stereo audio, moov atom at",
        "  the front. Web-safe, so video processing makes no Rendition.",
        "- `.mov`: HEVC (yuv420p, CRF 30, tagged hvc1 like Apple devices) with AAC stereo",
        "  audio in QuickTime MOV. Not web-safe, so video processing makes a Rendition.",
        "",
        "| File | Size | Codecs and container | Duration | creation_time | Source |",
        "| --- | --- | --- | --- | --- | --- |"
    );
    for (const clip of CLIPS) {
        for (const extension of ["mp4", "mov"]) {
            const name = `${clip.name}.${extension}`;
            lines.push(
                `| ${name} | ${await sizeOf(name)} | ${await describeVideo(name)} | ${clip.creationTime} | ${source(pages.get(clip.title))}, from ${clip.startSeconds} s |`
            );
        }
    }
    lines.push(
        "",
        "## Broken video",
        "",
        `\`${BROKEN.name}\` is made like the \`.mp4\` clips, and then its audio track's codec is changed`,
        "to one no decoder knows (the sample entry's fourcc `mp4a` becomes `xxxx`, and the object",
        "type in its decoder config, 0x40 for AAC, becomes 0xfe). Upload accepts it, since its",
        "metadata and thumbnail need only the video track. Video processing fails on it: its",
        "audio is not AAC, so it needs a Rendition, and making one needs the audio decoded, so it",
        "ends up failed with ffmpeg's `Decoder (codec none) not found for input stream #0:1`.",
        "",
        "| File | Size | Codecs and container | Duration | creation_time | Source |",
        "| --- | --- | --- | --- | --- | --- |",
        `| ${BROKEN.name} | ${await sizeOf(BROKEN.name)} | ${await describeVideo(BROKEN.name)} | ${BROKEN.creationTime} | ${source(pages.get(BROKEN.title))}, from ${BROKEN.startSeconds} s |`,
        ""
    );
    await writeFile(path.join(MEDIA_DIR, "SOURCES.md"), lines.join("\n"));
}

/** Table cells for a video's codecs, container and resolution, and its duration, as ffprobe reads them */
async function describeVideo(name) {
    const { streams, format } = await probe(path.join(MEDIA_DIR, name));
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");
    const audioCodec = !audio ? "no audio" : audio.codec_name ?? `unknown audio codec (${audio.codec_tag_string})`;
    const container = format.tags?.major_brand?.trim() === "qt" ? "MOV" : "MP4";
    const duration = `${Number(format.duration).toFixed(2)} s`;
    return `${video.codec_name} + ${audioCodec}, ${container}, ${video.width}x${video.height} | ${duration}`;
}

function stripHtml(html) {
    return (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** EXIF text fields are ASCII: accents are dropped, anything else becomes ? */
function asciiOnly(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
