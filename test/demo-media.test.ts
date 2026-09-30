import { mkdtemp, readdir, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageHelper } from "../src/lib/common/image-helper";
import { planRendition, VideoHelper } from "../src/lib/common/video-helper";

// The demo environment's seed builds its scenarios on what these files carry,
// as the app reads them. See demo/media/SOURCES.md.

const MEDIA_DIR = path.join(__dirname, "..", "demo", "media");
const BROKEN_VIDEO = "broken-audio.mp4";

async function mediaNamed(extension: string) {
    return (await readdir(MEDIA_DIR)).filter((name) => name.endsWith(extension)).sort();
}

describe("demo sample media", () => {
    let workDir: string;

    beforeEach(async () => {
        workDir = await mkdtemp(path.join(os.tmpdir(), "holvi-demo-media-"));
        // Photos with GPS are geocoded by an outside service; any place name will do
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({ countryName: "Testland", principalSubdivision: "", city: "", locality: "" })
            )
        );
    });

    afterEach(async () => {
        vi.unstubAllGlobals();
        await rm(workDir, { recursive: true, force: true });
    });

    it("has photos that all have a taken date, spread over several years, and GPS on some but not all", async () => {
        const photos = await mediaNamed(".jpg");
        const exifs = await Promise.all(
            photos.map(async (name) => ({ name, exif: await ImageHelper.getExif(path.join(MEDIA_DIR, name)) }))
        );

        expect(photos.length).toBeGreaterThanOrEqual(20);
        expect(exifs.filter(({ exif }) => !exif?.takenAt).map(({ name }) => name)).toEqual([]);
        const years = new Set(exifs.map(({ exif }) => exif!.takenAt!.getUTCFullYear()));
        expect(years.size).toBeGreaterThanOrEqual(5);
        const withGps = exifs.filter(({ exif }) => exif?.gps);
        expect(withGps.length).toBeGreaterThan(0);
        expect(withGps.length).toBeLessThan(photos.length);
        expect(withGps.every(({ exif }) => exif!.gps!.label === "Testland")).toBe(true);
    });

    it("has web-safe H.264 MP4 videos and HEVC MOV videos that need a Rendition, each with a capture date", async () => {
        const mp4s = (await mediaNamed(".mp4")).filter((name) => name !== BROKEN_VIDEO);
        const movs = await mediaNamed(".mov");

        expect(mp4s.length).toBeGreaterThanOrEqual(2);
        expect(movs.length).toBeGreaterThanOrEqual(2);
        for (const name of [...mp4s, ...movs]) {
            const { codecs, captureDate } = await VideoHelper.probe(path.join(MEDIA_DIR, name));
            expect(planRendition(codecs), name).toBe(name.endsWith(".mp4") ? null : "transcode");
            expect(codecs.videoCodec, name).toBe(name.endsWith(".mp4") ? "h264" : "hevc");
            expect(codecs.audioCodecs, name).toEqual(["aac"]);
            expect(captureDate, name).not.toBeNull();
        }
    });

    it("has a broken video that upload accepts but video processing fails on", async () => {
        const broken = path.join(MEDIA_DIR, BROKEN_VIDEO);

        // What upload reads from a video: its metadata and a thumbnail
        const { durationInSeconds } = await VideoHelper.getVideoMetadata(broken);
        expect(durationInSeconds).toBeGreaterThan(0);
        await VideoHelper.generateVideoThumbnail(broken, path.join(workDir, "tn", "thumbnail"));
        // What video processing does with it: it is not web-safe, and its Rendition cannot be made
        const { codecs } = await VideoHelper.probe(broken);
        const plan = planRendition(codecs);
        expect(plan).toBe("transcode");
        await expect(
            VideoHelper.produceRendition(broken, path.join(workDir, "rendition.mp4"), plan!, codecs, 8_000)
        ).rejects.toThrow("Decoder (codec none) not found");
    });
});
