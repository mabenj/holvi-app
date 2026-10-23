import {
    RestoreInspection,
    RestoreJobDto,
    RestoreSources
} from "../types/restore-job-dto";

export const RESTORE_JOBS_URL = "/api/restores";
export const RESTORE_SOURCES_URL = "/api/restores/sources";

// No JSON content type: the API routes parse the raw body themselves
async function request<T>(
    method: string,
    url: string,
    fallbackError: string,
    body?: unknown
) {
    const res = await fetch(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
        throw new Error(data.error || fallbackError);
    }
    return data as T;
}

/** The Backups the user can restore from, and why Restore is unavailable, if it is */
export function getRestoreSources() {
    return request<RestoreSources>(
        "GET",
        RESTORE_SOURCES_URL,
        "Could not load the Backups to restore from"
    );
}

/** A source's Manifest summary, or why it cannot be restored */
export async function inspectRestoreSource(sourceId: string) {
    const { inspection } = await request<{ inspection: RestoreInspection }>(
        "GET",
        `${RESTORE_SOURCES_URL}/${encodeURIComponent(sourceId)}`,
        "Could not read the Backup"
    );
    return inspection;
}

/** The user's Restore jobs, latest first */
export async function getRestoreJobs() {
    const { jobs } = await request<{ jobs: RestoreJobDto[] }>(
        "GET",
        RESTORE_JOBS_URL,
        "Could not load restores"
    );
    return jobs;
}

/** Queues a Restore job; refused with the reason if the source cannot be restored */
export async function startRestore(sourceId: string) {
    const { job } = await request<{ job: RestoreJobDto }>(
        "POST",
        RESTORE_JOBS_URL,
        "Could not start the restore",
        { sourceId }
    );
    return job;
}
