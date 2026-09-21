import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "./database";
import { createCollection, createUser, readDecryptedFile } from "./fixtures";
import {
    addVideo,
    GeneratedVideoOptions,
    probeVideo
} from "./video-fixtures";

describe("video fixture (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    const captureDate = new Date("2021-06-15T08:30:00Z");

    it.each<[string, GeneratedVideoOptions, object]>([
        [
            "a web-safe H.264/AAC MP4",
            { videoCodec: "h264", audio: "aac", container: "mp4", captureDate },
            { videoCodec: "h264", audioCodec: "aac", container: "mp4" }
        ],
        [
            "an H.264/AAC MOV",
            { videoCodec: "h264", audio: "aac", container: "mov", captureDate },
            { videoCodec: "h264", audioCodec: "aac", container: "mov" }
        ],
        [
            "an HEVC MP4 without audio, which is not web-safe",
            { videoCodec: "hevc", audio: "none", container: "mp4", captureDate },
            { videoCodec: "hevc", audioCodec: null, container: "mp4" }
        ]
    ])(
        "stores %s as an encrypted File that decrypts to the requested codecs and capture date",
        async (_, options, expected) => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");

            const file = await addVideo(user.id, holiday.id, "clip", options);

            const decrypted = await readDecryptedFile(
                user.id,
                holiday.id,
                file.id
            );
            expect(await probeVideo(decrypted)).toEqual({
                ...expected,
                captureDate
            });
        }
    );

    it("leaves the capture date out unless one is asked for", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");

        const file = await addVideo(user.id, holiday.id, "clip", {
            videoCodec: "h264",
            audio: "aac",
            container: "mp4"
        });

        const decrypted = await readDecryptedFile(user.id, holiday.id, file.id);
        expect((await probeVideo(decrypted)).captureDate).toBeNull();
    });
});
