import {
    backupDownloadUrl,
    cancelBackupJob,
    deleteBackup,
    startBackup
} from "@/lib/client/backups";
import { formatBytes, getErrorMessage } from "@/lib/common/utilities";
import { refreshActivity } from "@/lib/hooks/useActivity";
import { useBackupJobs } from "@/lib/hooks/useBackupJobs";
import { BackupJobDto, isCurrentBackup } from "@/lib/types/backup-job-dto";
import { Badge, Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { mdiBackupRestore, mdiDeleteOutline, mdiDownload } from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import ConfirmationSurface from "../surfaces/ConfirmationSurface";
import {
    ActiveJob,
    formatTimestamp,
    ProblemFiles,
    STATUS_LABELS,
    STATUS_PALETTES
} from "./JobParts";

/**
 * The Backups section of Settings: start a Backup job and follow its progress,
 * cancel it, and see the history with its problem files. The Current backup can
 * be downloaded or deleted.
 */
export default function Backups() {
    const { activeJob, history, error, isLoading, refresh } = useBackupJobs();
    const [busy, setBusy] = useState<"starting" | "cancelling">();
    const [actionError, setActionError] = useState<string>();
    const [jobToDelete, setJobToDelete] = useState<BackupJobDto>();
    const [deleting, setDeleting] = useState(false);

    const runJobAction = async (
        kind: "starting" | "cancelling",
        action: () => Promise<unknown>
    ) => {
        setBusy(kind);
        setActionError(undefined);
        try {
            await action();
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            await Promise.all([refresh(), refreshActivity()]);
            setBusy(undefined);
        }
    };

    const onConfirmDelete = async () => {
        if (!jobToDelete) return;
        setDeleting(true);
        setActionError(undefined);
        try {
            await deleteBackup(jobToDelete.id);
        } catch (error) {
            // Shown below the section once the confirmation closes
            setActionError(getErrorMessage(error));
        } finally {
            setJobToDelete(undefined);
            setDeleting(false);
            await refresh();
        }
    };

    if (isLoading) {
        return (
            <Flex justify="center" py="4">
                <Spinner aria-label="Loading backups" />
            </Flex>
        );
    }

    return (
        <Stack gap="5">
            <Text textStyle="sm" color="fg.muted">
                A Backup is one zip file with all your collections and files,
                decrypted. It is built in the background, and only the newest
                one is kept.
            </Text>
            {error && (
                <Text textStyle="sm" color="fg.error">
                    {error.message}
                </Text>
            )}
            {activeJob ? (
                <ActiveJob
                    kind="backup"
                    job={activeJob}
                    cancelling={busy === "cancelling"}
                    onCancel={() =>
                        runJobAction("cancelling", () =>
                            cancelBackupJob(activeJob.id)
                        )
                    }
                />
            ) : (
                <Button
                    size="lg"
                    loading={busy === "starting"}
                    onClick={() => runJobAction("starting", startBackup)}>
                    <Icon path={mdiBackupRestore} size="20px" aria-hidden />
                    Start backup
                </Button>
            )}
            {actionError && (
                <Text textStyle="sm" color="fg.error" role="alert">
                    {actionError}
                </Text>
            )}
            {history.length > 0 && (
                <Stack
                    as="ul"
                    gap="0"
                    listStyleType="none"
                    aria-label="Backup history">
                    {history.map((job) => (
                        <FinishedJob
                            key={job.id}
                            job={job}
                            onDelete={() => setJobToDelete(job)}
                        />
                    ))}
                </Stack>
            )}
            <ConfirmationSurface
                open={jobToDelete !== undefined}
                onClose={() => setJobToDelete(undefined)}
                title="Delete backup?"
                description="This deletes the zip from the server. Your collections and files stay in Holvi."
                confirmLabel="Delete"
                onConfirm={onConfirmDelete}
                confirming={deleting}
                destructive
            />
        </Stack>
    );
}

function FinishedJob({
    job,
    onDelete
}: {
    job: BackupJobDto;
    onDelete: () => void;
}) {
    // Only the Current backup still has a zip to download or delete
    const current = isCurrentBackup(job);
    return (
        <Stack as="li" gap="2" py="4" borderTopWidth="1px">
            <Flex align="center" gap="2" wrap="wrap">
                <Badge colorPalette={STATUS_PALETTES[job.status]}>
                    {STATUS_LABELS[job.status]}
                </Badge>
                {current && (
                    <Badge colorPalette="green" variant="solid">
                        Current backup
                    </Badge>
                )}
            </Flex>
            <Text textStyle="sm" color="fg.muted">
                {formatTimestamp(job.startedAt ?? job.queuedAt)}
                {job.zipSizeBytes !== null &&
                    ` · ${formatBytes(job.zipSizeBytes)}`}
            </Text>
            {job.errorMessage && (
                <Text textStyle="sm" color="fg.error">
                    {job.errorMessage}
                </Text>
            )}
            {job.problems.length > 0 && (
                <ProblemFiles problems={job.problems} />
            )}
            {current && (
                <Flex gap="2" wrap="wrap" mt="1">
                    <Button asChild flex="1" size="lg">
                        {/* A plain link: the browser downloads, and can resume, the zip */}
                        <a href={backupDownloadUrl(job.id)} download>
                            <Icon path={mdiDownload} size="20px" aria-hidden />
                            Download
                        </a>
                    </Button>
                    <Button
                        flex="1"
                        size="lg"
                        variant="outline"
                        colorPalette="red"
                        onClick={onDelete}>
                        <Icon path={mdiDeleteOutline} size="20px" aria-hidden />
                        Delete
                    </Button>
                </Flex>
            )}
        </Stack>
    );
}
