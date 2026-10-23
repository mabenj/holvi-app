import crypto from "crypto";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    createCollection,
    createUser,
    listFiles,
    waitFor
} from "../../../test/fixtures";
import { resetDatabase } from "../../../test/database";
import { pngImage } from "../../../test/upload-fixtures";
import {
    addVideo,
    generateUnscreenshottableVideo
} from "../../../test/video-fixtures";
import appConfig from "../common/app-config";
import { ImageHelper } from "../common/image-helper";
import { CollectionService } from "./collection.service";
import { ThumbnailService, ThumbnailStatus } from "./thumbnail.service";

/** Where uploads store a file's encrypted thumbnail */
function thumbnailPath(userId: string, collectionId: string, fileId: string) {
    return path.join(appConfig.dataDir, userId, collectionId, "tn", fileId);
}

/** Where the worker stages plaintext while making thumbnails */
const STAGING_DIR = path.join(appConfig.dataDir, "thumbnails");

function isIdle(status: ThumbnailStatus) {
    return status.pending === 0;
}

/** Kicks the worker and waits until none of the user's thumbnails are pending */
async function makeThumbnails(service: ThumbnailService) {
    ThumbnailService.kick();
    return waitFor(() => service.getStatus(), isIdle, 60_000);
}

describe("ThumbnailService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("makes a pending photo's thumbnail, stores it encrypted where uploads store thumbnails, and serves it", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const original = await pngImage();
        const photo = await addFile(user.id, trip.id, "beach.png", original, {
            mimeType: "image/png",
            thumbnailStatus: "pending"
        });
        const service = new ThumbnailService(user.id);

        const status = await makeThumbnails(service);

        expect(status).toEqual({ pending: 0, failed: 0 });
        const stored = await readFile(thumbnailPath(user.id, trip.id, photo.id));
        await expect(sharp(stored).metadata()).rejects.toThrow();
        const { file, placeholder } = await new CollectionService(
            user.id
        ).getThumbnail(trip.id, photo.id);
        expect(placeholder).toBe(false);
        expect(await sharp(file).metadata()).toMatchObject({
            width: 600,
            height: 450
        });
    });

    it("makes a pending video's thumbnail from a frame of it", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const video = await addVideo(
            user.id,
            trip.id,
            "clip",
            { videoCodec: "hevc", audio: "aac", container: "mov" },
            { thumbnailStatus: "pending" }
        );

        const status = await makeThumbnails(new ThumbnailService(user.id));

        expect(status).toEqual({ pending: 0, failed: 0 });
        const { file, placeholder } = await new CollectionService(
            user.id
        ).getThumbnail(trip.id, video.id);
        expect(placeholder).toBe(false);
        // The 96x64 video, scaled to fit 600x600
        expect(await sharp(file).metadata()).toMatchObject({
            width: 600,
            height: 400
        });
    });

    it("records why a thumbnail could not be made, keeps serving the blur placeholder, and goes on with the other files", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const blurDataUrl = await ImageHelper.generateBlur(await pngImage());
        const notAnImage = await addFile(
            user.id,
            trip.id,
            "broken.jpg",
            Buffer.from("not an image"),
            { thumbnailStatus: "pending", blurDataUrl }
        );
        const unscreenshottable = await addFile(
            user.id,
            trip.id,
            "broken.mp4",
            await generateUnscreenshottableVideo(),
            { mimeType: "video/mp4", thumbnailStatus: "pending", blurDataUrl }
        );
        const fine = await addFile(user.id, trip.id, "fine.png", await pngImage(), {
            mimeType: "image/png",
            thumbnailStatus: "pending"
        });
        const service = new ThumbnailService(user.id);

        const status = await makeThumbnails(service);

        expect(status).toEqual({ pending: 0, failed: 2 });
        const failed = await service.getFailedThumbnails();
        expect(
            failed.map(({ id, collectionId, name }) => ({ id, collectionId, name }))
        ).toEqual([
            { id: notAnImage.id, collectionId: trip.id, name: "broken.jpg" },
            { id: unscreenshottable.id, collectionId: trip.id, name: "broken.mp4" }
        ]);
        for (const { error } of failed) {
            expect(error).toEqual(expect.any(String));
        }
        const collections = new CollectionService(user.id);
        const blur = Buffer.from(blurDataUrl.split(",")[1], "base64");
        for (const broken of [notAnImage, unscreenshottable]) {
            const thumbnail = await collections.getThumbnail(trip.id, broken.id);
            expect(thumbnail).toMatchObject({
                placeholder: true,
                mimeType: "image/png"
            });
            expect(thumbnail.file.equals(blur)).toBe(true);
        }
        expect((await collections.getThumbnail(trip.id, fine.id)).placeholder).toBe(
            false
        );
        expect(await readdir(STAGING_DIR).catch(() => [])).toEqual([]);
    });

    it("deletes a file whose thumbnail was never made", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const photo = await addFile(user.id, trip.id, "a.png", await pngImage(), {
            mimeType: "image/png",
            thumbnailStatus: "pending"
        });
        const collections = new CollectionService(user.id);

        await collections.multiDelete([photo.id]);

        expect(await new ThumbnailService(user.id).getStatus()).toEqual({
            pending: 0,
            failed: 0
        });
        expect(await listFiles(path.join(appConfig.dataDir, user.id))).toEqual([]);
    });

    it("on startup empties the staging directory and resumes pending thumbnails", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const original = await pngImage();
        // Left behind by a server that stopped while making its thumbnail
        const interrupted = await addFile(user.id, trip.id, "a.png", original, {
            mimeType: "image/png",
            thumbnailStatus: "pending"
        });
        await mkdir(path.join(STAGING_DIR, interrupted.id), { recursive: true });
        await writeFile(
            path.join(STAGING_DIR, interrupted.id, "original"),
            original
        );
        await mkdir(path.join(STAGING_DIR, crypto.randomUUID()), {
            recursive: true
        });
        const service = new ThumbnailService(user.id);
        const beforeRecovery = await service.getStatus();

        await ThumbnailService.recover();
        const finished = await waitFor(() => service.getStatus(), isIdle, 60_000);

        expect(beforeRecovery).toEqual({ pending: 1, failed: 0 });
        expect(finished).toEqual({ pending: 0, failed: 0 });
        expect(
            (await new CollectionService(user.id).getThumbnail(trip.id, interrupted.id))
                .placeholder
        ).toBe(false);
        expect(await readdir(STAGING_DIR).catch(() => [])).toEqual([]);
    });
});
