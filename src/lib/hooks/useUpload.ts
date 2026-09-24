import { useCallback, useSyncExternalStore } from "react";
import { fetchCollection, uploadFiles } from "../client/collections";
import { getErrorMessage } from "../common/utilities";
import { refreshActivity } from "./useActivity";
import { featureCollection } from "./useCollectionsBrowse";

/** One upload of files into a collection */
export type Upload =
    | {
          status: "uploading";
          fileCount: number;
          /** Share of the bytes sent so far, from 0 to 1 */
          progress: number;
      }
    /** Everything is sent; the server is processing and storing the files */
    | { status: "processing"; fileCount: number }
    | {
          status: "done";
          fileCount: number;
          added: number;
          /** Files the server skipped (e.g. duplicates) or could not process */
          errors: string[];
          /** Counts finished uploads, so a screen can tell a new one from the last */
          sequence: number;
      }
    | { status: "failed"; fileCount: number; error: string };

/** The latest upload into each collection, kept in app memory so it survives leaving the screen */
const uploads = new Map<string, Upload>();
const listeners = new Set<() => void>();
let finished = 0;

function set(collectionId: string, upload: Upload | null) {
    if (upload) uploads.set(collectionId, upload);
    else uploads.delete(collectionId);
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function isUploading(upload: Upload | null) {
    return upload?.status === "uploading" || upload?.status === "processing";
}

/**
 * Uploads files into the user's collection. When it ends, the collection is
 * shown first on the Collections tab for the next visit.
 */
export async function startUpload(
    userId: string,
    collectionId: string,
    files: File[]
) {
    if (files.length === 0 || isUploading(uploads.get(collectionId) ?? null)) {
        return;
    }
    const fileCount = files.length;
    set(collectionId, { status: "uploading", fileCount, progress: 0 });
    try {
        const { added, errors } = await uploadFiles(
            collectionId,
            files,
            ({ loaded, total }) =>
                set(
                    collectionId,
                    loaded < total
                        ? {
                              status: "uploading",
                              fileCount,
                              progress: loaded / total
                          }
                        : { status: "processing", fileCount }
                )
        );
        set(collectionId, {
            status: "done",
            fileCount,
            added,
            errors,
            sequence: ++finished
        });
        if (added > 0) {
            // New videos are pending, which the Settings tab badge shows
            void refreshActivity();
            fetchCollection(collectionId)
                .then((collection) => featureCollection(userId, collection))
                .catch(() => undefined);
        }
    } catch (error) {
        set(collectionId, {
            status: "failed",
            fileCount,
            error: getErrorMessage(error)
        });
    }
}

/** The latest upload into the collection, if it has not been dismissed */
export function useUpload(collectionId: string) {
    const upload = useSyncExternalStore(
        subscribe,
        () => uploads.get(collectionId) ?? null,
        () => null
    );
    const dismiss = useCallback(() => {
        if (!isUploading(uploads.get(collectionId) ?? null)) {
            set(collectionId, null);
        }
    }, [collectionId]);
    return { upload, dismiss };
}
