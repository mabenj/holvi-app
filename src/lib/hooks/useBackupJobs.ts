import useSWR from "swr";
import { BACKUP_JOBS_URL, getBackupJobs } from "../client/backups";
import { isActiveBackupJobStatus } from "../types/backup-job-dto";

const POLL_INTERVAL_MS = 2_000;

/**
 * The user's backup jobs, latest first. Polls while a job is queued or running,
 * so progress comes from the server and survives a page reload.
 */
export function useBackupJobs() {
    const { data, error, isLoading, mutate } = useSWR(
        BACKUP_JOBS_URL,
        getBackupJobs,
        {
            refreshInterval: (latest) =>
                latest?.some((job) => isActiveBackupJobStatus(job.status))
                    ? POLL_INTERVAL_MS
                    : 0
        }
    );
    const jobs = data ?? [];
    return {
        jobs,
        activeJob: jobs.find((job) => isActiveBackupJobStatus(job.status)),
        history: jobs.filter((job) => !isActiveBackupJobStatus(job.status)),
        error: error as Error | undefined,
        isLoading,
        refresh: mutate
    };
}
