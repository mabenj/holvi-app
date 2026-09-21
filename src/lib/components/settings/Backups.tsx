import {
    backupDownloadUrl,
    cancelBackupJob,
    deleteBackup,
    startBackup
} from "@/lib/client/backups";
import { formatBytes, getErrorMessage } from "@/lib/common/utilities";
import { useBackupJobs } from "@/lib/hooks/useBackupJobs";
import {
    BackupJobDto,
    BackupJobStatus,
    BackupProblem,
    isCurrentBackup
} from "@/lib/types/backup-job-dto";
import {
    Badge,
    Box,
    Button,
    Collapsible,
    Flex,
    Progress,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import {
    mdiBackupRestore,
    mdiChevronDown,
    mdiClose,
    mdiDeleteOutline,
    mdiDownload
} from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import ConfirmationSurface from "../surfaces/ConfirmationSurface";

const STATUS_LABELS: Record<BackupJobStatus, string> = {
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    completedWithErrors: "Completed with errors",
    failed: "Failed",
    cancelled: "Cancelled"
};

const STATUS_PALETTES: Record<BackupJobStatus, string> = {
    queued: "gray",
    running: "blue",
    completed: "green",
    completedWithErrors: "orange",
    failed: "red",
    cancelled: "gray"
};

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
            await refresh();
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

function ActiveJob({
    job,
    cancelling,
    onCancel
}: {
    job: BackupJobDto;
    cancelling: boolean;
    onCancel: () => void;
}) {
    const { progress } = job;
    return (
        <Stack
            gap="4"
            p="4"
            borderWidth="1px"
            rounded="lg"
            bg="bg.subtle"
            aria-live="polite">
            <Flex align="center" gap="2">
                <Spinner size="sm" colorPalette={STATUS_PALETTES[job.status]} />
                <Text fontWeight="medium">
                    {job.status === "queued" ? "Backup queued" : "Backing up"}
                </Text>
            </Flex>
            {job.status === "queued" ? (
                <Text textStyle="sm" color="fg.muted">
                    Only one backup runs on the server at a time. This one
                    starts when the ones ahead of it have finished.
                </Text>
            ) : (
                <>
                    <ProgressRow
                        label="Files"
                        valueText={`${progress.filesDone} / ${progress.filesTotal}`}
                        done={progress.filesDone}
                        total={progress.filesTotal}
                    />
                    <ProgressRow
                        label="Size"
                        valueText={`${formatBytes(progress.bytesDone)} / ${formatBytes(progress.bytesTotal)}`}
                        done={progress.bytesDone}
                        total={progress.bytesTotal}
                    />
                    <Text textStyle="sm" color="fg.muted">
                        Collections {progress.collectionsDone} /{" "}
                        {progress.collectionsTotal}
                    </Text>
                    {progress.currentFileName && (
                        <Text textStyle="sm" color="fg.muted" truncate>
                            {progress.currentFileName}
                        </Text>
                    )}
                </>
            )}
            <Button
                variant="outline"
                size="lg"
                colorPalette="red"
                loading={cancelling}
                onClick={onCancel}>
                <Icon path={mdiClose} size="20px" aria-hidden />
                Cancel backup
            </Button>
        </Stack>
    );
}

function ProgressRow({
    label,
    valueText,
    done,
    total
}: {
    label: string;
    valueText: string;
    done: number;
    total: number;
}) {
    return (
        <Progress.Root
            value={total > 0 ? Math.min(100, (done / total) * 100) : 0}
            size="sm">
            <Flex justify="space-between" mb="1.5" gap="2">
                <Progress.Label textStyle="sm">{label}</Progress.Label>
                <Text textStyle="sm" color="fg.muted">
                    {valueText}
                </Text>
            </Flex>
            <Progress.Track rounded="full">
                <Progress.Range />
            </Progress.Track>
        </Progress.Root>
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
                <ProblemFiles
                    problems={job.problems}
                    skippedCount={job.skippedCount}
                    damagedCount={job.damagedCount}
                />
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

function ProblemFiles({
    problems,
    skippedCount,
    damagedCount
}: {
    problems: BackupProblem[];
    skippedCount: number;
    damagedCount: number;
}) {
    return (
        <Collapsible.Root>
            <Collapsible.Trigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    px="0"
                    color="fg.warning"
                    css={{
                        "& [data-chevron]": { transition: "transform 0.2s" },
                        "&[data-state=open] [data-chevron]": {
                            transform: "rotate(180deg)"
                        }
                    }}>
                    {problems.length} problem file
                    {problems.length === 1 ? "" : "s"} ({skippedCount} skipped,{" "}
                    {damagedCount} damaged)
                    <Box as="span" data-chevron display="inline-flex">
                        <Icon path={mdiChevronDown} size="18px" aria-hidden />
                    </Box>
                </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <Stack as="ul" gap="2" pt="1" listStyleType="none">
                    {problems.map((problem) => (
                        <Box as="li" key={problem.fileId} textStyle="sm">
                            <Text fontWeight="medium" wordBreak="break-all">
                                {problem.name}
                            </Text>
                            <Text color="fg.muted">
                                {describeProblem(problem)}
                            </Text>
                        </Box>
                    ))}
                </Stack>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}

function describeProblem(problem: BackupProblem) {
    if (problem.kind === "skipped") {
        return `Skipped · ${problem.reason}`;
    }
    const expected =
        problem.bytesExpected === null
            ? "unknown size"
            : formatBytes(problem.bytesExpected);
    return `Damaged · ${problem.reason} · ${formatBytes(problem.bytesWritten ?? 0)} of ${expected} written`;
}

function formatTimestamp(epochMs: number) {
    return new Date(epochMs).toLocaleString();
}
