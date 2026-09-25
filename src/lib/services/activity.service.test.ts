import { beforeEach, describe, expect, it } from "vitest";
import { CollectionFile } from "@/db/models/CollectionFile";
import { addFile, createCollection, createUser } from "../../../test/fixtures";
import { getTestDatabase, resetDatabase } from "../../../test/database";
import { ActivityService } from "./activity.service";

async function addVideoRow(
    userId: string,
    collectionId: string,
    name: string,
    processingStatus: CollectionFile["processingStatus"]
) {
    return addFile(userId, collectionId, name, Buffer.from(name), {
        mimeType: "video/mp4",
        processingStatus
    });
}

describe("ActivityService", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("reports only the requesting user's Backup job and video processing", async () => {
        const db = await getTestDatabase();
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const trip = await createCollection(alice.id, "Trip");
        const bobsTrip = await createCollection(bob.id, "Bob's trip");
        await addVideoRow(alice.id, trip.id, "a-pending.mp4", "pending");
        await addVideoRow(alice.id, trip.id, "a-pending-2.mp4", "pending");
        const current = await addVideoRow(
            alice.id,
            trip.id,
            "a-processing.mp4",
            "processing"
        );
        await addVideoRow(alice.id, trip.id, "a-done.mp4", "done");
        await addVideoRow(alice.id, trip.id, "a-never.mp4", null);
        await addVideoRow(bob.id, bobsTrip.id, "b-pending.mp4", "pending");
        await addVideoRow(bob.id, bobsTrip.id, "b-processing.mp4", "processing");
        await addVideoRow(bob.id, bobsTrip.id, "b-failed.mp4", "failed");
        // Rows only, so the instance's backup runner does not pick them up
        await db.models.BackupJob.create({
            UserId: alice.id,
            status: "completed",
            queuedAt: new Date("2026-01-01T00:00:00Z"),
            finishedAt: new Date("2026-01-01T00:10:00Z")
        });
        const aliceJob = await db.models.BackupJob.create({
            UserId: alice.id,
            status: "running",
            queuedAt: new Date("2026-02-01T00:00:00Z"),
            startedAt: new Date("2026-02-01T00:00:00Z"),
            filesDone: 3,
            filesTotal: 10,
            bytesDone: 3_000,
            bytesTotal: 10_000,
            currentFileName: "beach.jpg"
        });
        await db.models.BackupJob.create({
            UserId: bob.id,
            status: "queued",
            queuedAt: new Date("2026-01-15T00:00:00Z")
        });

        const activity = await new ActivityService(alice.id).getActivity();

        expect(activity.backupJob).toMatchObject({
            id: aliceJob.id,
            status: "running",
            progress: {
                filesDone: 3,
                filesTotal: 10,
                bytesDone: 3_000,
                bytesTotal: 10_000,
                currentFileName: "beach.jpg"
            }
        });
        expect(activity.videoProcessing).toEqual({
            pending: 2,
            processing: 1,
            done: 1,
            failed: 0,
            currentFile: {
                id: current.id,
                collectionId: trip.id,
                name: "a-processing.mp4"
            }
        });
        expect(activity.active).toBe(true);
    });

    it("reports no Backup job and nothing active once the user's work has ended", async () => {
        const db = await getTestDatabase();
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const trip = await createCollection(alice.id, "Trip");
        const bobsTrip = await createCollection(bob.id, "Bob's trip");
        await addVideoRow(alice.id, trip.id, "a-done.mp4", "done");
        await addVideoRow(alice.id, trip.id, "a-failed.mp4", "failed");
        await addVideoRow(bob.id, bobsTrip.id, "b-pending.mp4", "pending");
        await db.models.BackupJob.create({
            UserId: alice.id,
            status: "cancelled",
            queuedAt: new Date("2026-01-01T00:00:00Z"),
            finishedAt: new Date("2026-01-01T00:01:00Z")
        });
        await db.models.BackupJob.create({
            UserId: bob.id,
            status: "queued",
            queuedAt: new Date("2026-01-15T00:00:00Z")
        });

        const activity = await new ActivityService(alice.id).getActivity();

        expect(activity).toEqual({
            backupJob: null,
            videoProcessing: {
                pending: 0,
                processing: 0,
                done: 1,
                failed: 1,
                currentFile: null
            },
            active: false
        });
    });
});
