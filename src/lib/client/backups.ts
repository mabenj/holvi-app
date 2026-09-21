import { BackupJobDto } from "../types/backup-job-dto";

export const BACKUP_JOBS_URL = "/api/backups";

// No JSON content type: the API routes parse the raw body themselves
async function request<T>(method: string, url: string, fallbackError: string) {
    const res = await fetch(url, { method });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
        throw new Error(data.error || fallbackError);
    }
    return data as T;
}

/** The user's backup jobs, latest first */
export async function getBackupJobs() {
    const { jobs } = await request<{ jobs: BackupJobDto[] }>(
        "GET",
        BACKUP_JOBS_URL,
        "Could not load backups"
    );
    return jobs;
}

/** Queues a Backup job, or returns the user's queued or running one */
export async function startBackup() {
    const { job } = await request<{ job: BackupJobDto }>(
        "POST",
        BACKUP_JOBS_URL,
        "Could not start the backup"
    );
    return job;
}

/** Resolves once a running job has stopped */
export async function cancelBackupJob(jobId: string) {
    const { job } = await request<{ job: BackupJobDto }>(
        "POST",
        `${BACKUP_JOBS_URL}/${jobId}/cancel`,
        "Could not cancel the backup"
    );
    return job;
}

/** Deletes the job's zip; the job stays in the history */
export async function deleteBackup(jobId: string) {
    const { job } = await request<{ job: BackupJobDto }>(
        "DELETE",
        `${BACKUP_JOBS_URL}/${jobId}`,
        "Could not delete the backup"
    );
    return job;
}

/** Served with range support, so the browser can resume an interrupted download */
export function backupDownloadUrl(jobId: string) {
    return `${BACKUP_JOBS_URL}/${jobId}/download`;
}
