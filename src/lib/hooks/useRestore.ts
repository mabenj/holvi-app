import useSWR from "swr";
import {
    getRestoreJobs,
    getRestoreSources,
    RESTORE_JOBS_URL,
    RESTORE_SOURCES_URL
} from "../client/restores";
import { isActiveJobStatus } from "../types/job-dto";

const POLL_INTERVAL_MS = 2_000;

/**
 * The Backups the user can restore from and their Restore jobs, latest first.
 * Polls the jobs while one is queued or running, so progress comes from the
 * server and survives a page reload.
 */
export function useRestore() {
    const sources = useSWR(RESTORE_SOURCES_URL, getRestoreSources);
    const jobs = useSWR(RESTORE_JOBS_URL, getRestoreJobs, {
        refreshInterval: (latest) =>
            latest?.some((job) => isActiveJobStatus(job.status))
                ? POLL_INTERVAL_MS
                : 0
    });
    const allJobs = jobs.data ?? [];
    return {
        sources: sources.data,
        activeJob: allJobs.find((job) => isActiveJobStatus(job.status)),
        history: allJobs.filter((job) => !isActiveJobStatus(job.status)),
        error: (sources.error ?? jobs.error) as Error | undefined,
        isLoading: sources.isLoading || jobs.isLoading,
        refresh: () => Promise.all([sources.mutate(), jobs.mutate()])
    };
}
