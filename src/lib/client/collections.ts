import type { CollectionDetails } from "../types/collection-details";
import type { CollectionFileType } from "../types/collection-file-type";
import type { CollectionSummary } from "../types/collection-summary";
import type { FileSort } from "../types/file-sort";
import type { FileSummary } from "../types/file-summary";

export interface CollectionsPage {
    collections: CollectionSummary[];
    nextCursor: string | null;
    seed: string;
}

/** What narrows the Collections tab: tags (all of them), file type and a name search */
export interface CollectionsFilter {
    tags: string[];
    fileType: CollectionFileType;
    q: string;
}

export const NO_COLLECTIONS_FILTER: CollectionsFilter = {
    tags: [],
    fileType: "any",
    q: ""
};

/** Whether the filter leaves out any collections */
export function isFiltering(filter: CollectionsFilter) {
    return (
        filter.tags.length > 0 || filter.fileType !== "any" || !!filter.q.trim()
    );
}

/** The same key for filters that match the same collections */
export function collectionsFilterKey(filter: CollectionsFilter) {
    return JSON.stringify([
        filter.tags.map((tag) => tag.toLowerCase()).sort(),
        filter.fileType,
        filter.q.trim().toLowerCase()
    ]);
}

export interface FilesPage {
    files: FileSummary[];
    nextCursor: string | null;
}

/** GETs an API route's JSON, throwing the route's error message, or `failure`, when it fails */
async function getJson(
    url: string,
    failure: string,
    options: { signal?: AbortSignal; notFound?: string } = {}
) {
    const res = await fetch(url, { signal: options.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            (res.status === 404 && options.notFound) || data.error || failure
        );
    }
    return data;
}

/** One page of the user's collections that match the filter, in random order */
export async function fetchCollectionsPage(
    options: { filter: CollectionsFilter; seed?: string; cursor?: string },
    signal?: AbortSignal
): Promise<CollectionsPage> {
    const { tags, fileType, q } = options.filter;
    const params = new URLSearchParams({ sort: "random" });
    tags.forEach((tag) => params.append("tags", tag));
    if (fileType !== "any") params.set("fileType", fileType);
    if (q.trim()) params.set("q", q.trim());
    if (options.seed) params.set("seed", options.seed);
    if (options.cursor) params.set("cursor", options.cursor);
    const data = await getJson(
        `/api/collections?${params}`,
        "Could not load collections",
        { signal }
    );
    return {
        collections: data.collections,
        nextCursor: data.nextCursor,
        seed: data.seed
    };
}

export function collectionUrl(collectionId: string) {
    return `/api/collections/${encodeURIComponent(collectionId)}`;
}

/** One of the user's collections, with its description */
export async function fetchCollection(
    collectionId: string
): Promise<CollectionDetails> {
    const data = await getJson(
        collectionUrl(collectionId),
        "Could not load the collection",
        { notFound: "This collection does not exist" }
    );
    return data.collection;
}

/** One page of a collection's files that have every one of the tags, in the given order */
export async function fetchFilesPage(
    collectionId: string,
    options: { sort: FileSort; tags: string[]; cursor?: string },
    signal?: AbortSignal
): Promise<FilesPage> {
    const params = new URLSearchParams({ sort: options.sort });
    options.tags.forEach((tag) => params.append("tags", tag));
    if (options.cursor) params.set("cursor", options.cursor);
    const data = await getJson(
        `${collectionUrl(collectionId)}/files?${params}`,
        "Could not load the files",
        { signal }
    );
    return { files: data.files, nextCursor: data.nextCursor };
}

/** What the collection editor saves */
export interface CollectionFields {
    name: string;
    description: string;
    tags: string[];
}

/** The saved collection's id, or why its name was rejected */
export type SaveCollectionResult = { id: string } | { nameError: string };

/**
 * Sends JSON to an API route. The body goes as plain text: the routes parse
 * the raw body themselves, so a JSON content type would break them.
 */
async function sendJson(
    url: string,
    method: "POST" | "DELETE",
    body: unknown,
    failure: string
) {
    const res = await fetch(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.nameError) {
        throw new Error(data.error || failure);
    }
    return data;
}

export async function createCollection(
    fields: CollectionFields
): Promise<SaveCollectionResult> {
    const data = await sendJson(
        "/api/collections",
        "POST",
        fields,
        "Could not create the collection"
    );
    return data.nameError
        ? { nameError: data.nameError }
        : { id: data.collection.id };
}

export async function updateCollection(
    collectionId: string,
    fields: CollectionFields
): Promise<SaveCollectionResult> {
    const data = await sendJson(
        collectionUrl(collectionId),
        "POST",
        fields,
        "Could not save the collection"
    );
    return data.nameError ? { nameError: data.nameError } : { id: collectionId };
}

export async function deleteCollection(collectionId: string) {
    await sendJson(
        collectionUrl(collectionId),
        "DELETE",
        undefined,
        "Could not delete the collection"
    );
}

/**
 * Deletes a selection of the user's collections, or of their files, all at
 * once. Ids that are not the user's are left alone.
 */
export async function deleteSelection(ids: string[]) {
    await sendJson("/api/multiDelete", "POST", ids, "Could not delete them");
}

/** What the file editor saves */
export interface FileFields {
    name: string;
    tags: string[];
}

/** Saves a file's name and tags */
export async function updateFile(
    collectionId: string,
    fileId: string,
    fields: FileFields
) {
    await sendJson(
        `${collectionUrl(collectionId)}/files`,
        "POST",
        { id: fileId, ...fields },
        "Could not save the file"
    );
}

/** Existing tags that contain the query, for tag inputs */
export async function fetchTagSuggestions(
    query: string,
    signal?: AbortSignal
): Promise<string[]> {
    const data = await getJson(
        `/api/search/tags?${new URLSearchParams({ query })}`,
        "Could not load tag suggestions",
        { signal }
    );
    return data.tags;
}

export interface UploadProgress {
    loaded: number;
    total: number;
}

/** How an upload ended: how many files were added, and the files the server skipped or could not process */
export interface UploadResult {
    added: number;
    errors: string[];
}

/**
 * Uploads files into a collection, reporting how much has been sent. XHR
 * rather than fetch, since fetch cannot report upload progress.
 */
export function uploadFiles(
    collectionId: string,
    files: File[],
    onProgress: (progress: UploadProgress) => void
): Promise<UploadResult> {
    const form = new FormData();
    // The server reads each file's last-modified time from its field name
    files.forEach((file) => form.append(String(file.lastModified), file));

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                onProgress({ loaded: event.loaded, total: event.total });
            }
        });
        xhr.addEventListener("load", () => {
            let data: { error?: string; files?: unknown[]; errors?: string[] } =
                {};
            try {
                data = JSON.parse(xhr.responseText);
            } catch {
                // Not JSON, e.g. a proxy's error page
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(data.error || "Could not upload the files"));
                return;
            }
            resolve({
                added: data.files?.length ?? 0,
                errors: data.errors ?? []
            });
        });
        xhr.addEventListener("error", () =>
            reject(new Error("The upload was interrupted"))
        );
        xhr.open("POST", `${collectionUrl(collectionId)}/files/upload`);
        xhr.send(form);
    });
}

/** One page of the Timeline: every file the user owns, newest first */
export async function fetchTimelinePage(
    cursor: string | undefined,
    signal?: AbortSignal
): Promise<FilesPage> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const data = await getJson(
        `/api/files?${params}`,
        "Could not load the Timeline",
        { signal }
    );
    return { files: data.files, nextCursor: data.nextCursor };
}
