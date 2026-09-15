import { useToast } from "@chakra-ui/react";
import { useState } from "react";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { getErrorMessage } from "../common/utilities";
import {
    BackupJobDto,
    isActiveBackupJobStatus
} from "../types/backup-job-dto";
import { useHttp } from "./useHttp";

const POLL_INTERVAL_MS = 3_000;

export function useBackups() {
    const [isStarting, setIsStarting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const http = useHttp();
    const toast = useToast();

    const fetcher = async (url: string) => {
        const { data, error } = await http.get<
            ApiData<{ jobs?: BackupJobDto[] }>
        >(url);
        if (!data?.jobs || error) {
            throw new Error(getErrorMessage(error) || "Could not fetch backups");
        }
        return data.jobs;
    };

    const {
        data: jobs,
        isLoading,
        mutate
    } = useSWR("/api/backups", fetcher, {
        // Poll only while a backup job is queued or running
        refreshInterval: (latest) =>
            latest?.some((job) => isActiveBackupJobStatus(job.status))
                ? POLL_INTERVAL_MS
                : 0
    });

    const startBackup = async () => {
        setIsStarting(true);
        const { data, error } = await http
            .post<ApiData<{ job?: BackupJobDto }>>("/api/backups")
            .finally(() => setIsStarting(false));
        if (!data?.job || error) {
            toast({
                description: `Could not start backup (${getErrorMessage(
                    error
                )})`,
                status: "error"
            });
            return;
        }
        await mutate();
    };

    const cancelBackup = async (jobId: string) => {
        setIsCancelling(true);
        const { data, error } = await http
            .post<ApiData<{ job?: BackupJobDto }>>(
                `/api/backups/${jobId}/cancel`
            )
            .finally(() => setIsCancelling(false));
        if (!data?.job || error) {
            toast({
                description: `Could not cancel backup (${getErrorMessage(
                    error
                )})`,
                status: "error"
            });
        }
        await mutate();
    };

    return {
        jobs: jobs || [],
        isLoading,
        isStarting,
        isCancelling,
        startBackup,
        cancelBackup
    };
}
