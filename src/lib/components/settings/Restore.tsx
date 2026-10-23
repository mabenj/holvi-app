import {
    cancelRestoreJob,
    inspectRestoreSource,
    startRestore
} from "@/lib/client/restores";
import { formatBytes, getErrorMessage, plural } from "@/lib/common/utilities";
import { refreshActivity } from "@/lib/hooks/useActivity";
import { useRestore } from "@/lib/hooks/useRestore";
import {
    RestoreInspection,
    RestoreJobDto,
    RestoreSourceDto,
    UnrestoredFile
} from "@/lib/types/restore-job-dto";
import {
    Badge,
    Box,
    Button,
    Collapsible,
    Flex,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiBackupRestore, mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useRef, useState } from "react";
import ConfirmationSurface from "../surfaces/ConfirmationSurface";
import {
    ActiveJob,
    formatTimestamp,
    ProblemFiles,
    STATUS_LABELS,
    STATUS_PALETTES
} from "./JobParts";

/**
 * The Restore section of Settings: the Backups the user can restore from, a
 * summary of one from its Manifest, confirmation, the running Restore job's
 * progress, and past jobs with their Unrestored and Problem files.
 */
export default function Restore() {
    const { sources, activeJob, history, error, isLoading, refresh } =
        useRestore();
    const [inspection, setInspection] = useState<RestoreInspection>();
    const [inspecting, setInspecting] = useState<string>();
    const [confirming, setConfirming] = useState(false);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [actionError, setActionError] = useState<string>();

    // A finished job changes what can be restored: the account now has collections
    const activeJobId = activeJob?.id;
    const previousActiveJobId = useRef(activeJobId);
    useEffect(() => {
        if (previousActiveJobId.current && !activeJobId) {
            void refresh();
        }
        previousActiveJobId.current = activeJobId;
    }, [activeJobId, refresh]);

    const onInspect = async (source: RestoreSourceDto) => {
        setInspecting(source.id);
        setActionError(undefined);
        try {
            setInspection(await inspectRestoreSource(source.id));
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setInspecting(undefined);
        }
    };

    const onConfirmStart = async () => {
        if (!inspection) return;
        setStarting(true);
        setActionError(undefined);
        try {
            await startRestore(inspection.source.id);
            setInspection(undefined);
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setConfirming(false);
            setStarting(false);
            await Promise.all([refresh(), refreshActivity()]);
        }
    };

    const onCancel = async (job: RestoreJobDto) => {
        setCancelling(true);
        setActionError(undefined);
        try {
            await cancelRestoreJob(job.id);
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            await Promise.all([refresh(), refreshActivity()]);
            setCancelling(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justify="center" py="4">
                <Spinner aria-label="Loading restores" />
            </Flex>
        );
    }

    const unavailableReason = sources?.unavailableReason ?? null;
    return (
        <Stack gap="5">
            <Text textStyle="sm" color="fg.muted">
                A Restore brings the collections and files of a Backup back
                into your account, with their tags, Covers and dates. The
                Backup must already be on this instance: your Current backup,
                or a zip the operator placed in your folder.
            </Text>
            {error && (
                <Text textStyle="sm" color="fg.error">
                    {error.message}
                </Text>
            )}
            {activeJob ? (
                <ActiveJob
                    kind="restore"
                    job={activeJob}
                    cancelling={cancelling}
                    onCancel={() => onCancel(activeJob)}>
                    <Text textStyle="sm" color="fg.muted">
                        Your collections appear all at once when the Restore
                        has finished.
                    </Text>
                </ActiveJob>
            ) : (
                <>
                    {unavailableReason && (
                        <Text textStyle="sm" color="fg.warning" role="note">
                            {unavailableReason}. Restore is meant for when your
                            data has been lost.
                        </Text>
                    )}
                    {sources && sources.sources.length === 0 && (
                        <Text textStyle="sm" color="fg.muted">
                            {sources.hint ??
                                `No Backups to restore from. Ask the operator to place your Backup zip in your folder, '${sources.folderName}', in the restore directory.`}
                        </Text>
                    )}
                    {sources && sources.sources.length > 0 && (
                        <Stack
                            as="ul"
                            gap="0"
                            listStyleType="none"
                            aria-label="Backups to restore from">
                            {sources.sources.map((source) => (
                                <Source
                                    key={source.id}
                                    source={source}
                                    disabled={unavailableReason !== null}
                                    inspecting={inspecting === source.id}
                                    onInspect={() => onInspect(source)}
                                />
                            ))}
                        </Stack>
                    )}
                    {inspection && (
                        <Inspection
                            inspection={inspection}
                            onRestore={() => setConfirming(true)}
                            onClose={() => setInspection(undefined)}
                        />
                    )}
                </>
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
                    aria-label="Restore history">
                    {history.map((job) => (
                        <FinishedJob key={job.id} job={job} />
                    ))}
                </Stack>
            )}
            <ConfirmationSurface
                open={confirming}
                onClose={() => setConfirming(false)}
                title="Restore this Backup?"
                description="The Restore runs in the background and can take hours for a large Backup. Nothing appears in your account until it has finished."
                confirmLabel="Restore"
                onConfirm={onConfirmStart}
                confirming={starting}
            />
        </Stack>
    );
}

function Source({
    source,
    disabled,
    inspecting,
    onInspect
}: {
    source: RestoreSourceDto;
    disabled: boolean;
    inspecting: boolean;
    onInspect: () => void;
}) {
    return (
        <Flex
            as="li"
            align="center"
            gap="3"
            py="3"
            borderTopWidth="1px"
            wrap="wrap">
            <Stack gap="1" flex="1" minW="0">
                <Flex align="center" gap="2" wrap="wrap">
                    <Text fontWeight="medium" wordBreak="break-all">
                        {source.fileName}
                    </Text>
                    {source.kind === "current" && (
                        <Badge colorPalette="green">Current backup</Badge>
                    )}
                </Flex>
                <Text textStyle="sm" color="fg.muted">
                    {source.takenAt !== null
                        ? `Taken ${formatTimestamp(source.takenAt)} · `
                        : ""}
                    {formatBytes(source.sizeBytes)}
                </Text>
            </Stack>
            <Button
                variant="outline"
                disabled={disabled}
                loading={inspecting}
                onClick={onInspect}>
                Review
            </Button>
        </Flex>
    );
}

function Inspection({
    inspection,
    onRestore,
    onClose
}: {
    inspection: RestoreInspection;
    onRestore: () => void;
    onClose: () => void;
}) {
    const { source, summary, reason } = inspection;
    return (
        <Stack gap="3" p="4" borderWidth="1px" rounded="lg" bg="bg.subtle">
            <Text fontWeight="medium" wordBreak="break-all">
                {source.fileName}
            </Text>
            {summary ? (
                <>
                    <Stack as="dl" gap="1" textStyle="sm">
                        <SummaryRow label="Backup of" value={summary.username} />
                        <SummaryRow
                            label="Taken"
                            value={formatTimestamp(summary.takenAt)}
                        />
                        <SummaryRow
                            label="Collections"
                            value={String(summary.collectionCount)}
                        />
                        <SummaryRow
                            label="Files"
                            value={`${summary.fileCount} (${formatBytes(summary.bytes)})`}
                        />
                    </Stack>
                    {summary.problems.length > 0 && (
                        <ProblemFiles problems={summary.problems} />
                    )}
                </>
            ) : (
                <Text textStyle="sm" color="fg.error">
                    {reason}
                </Text>
            )}
            <Flex gap="2" wrap="wrap">
                {summary && (
                    <Button flex="1" size="lg" onClick={onRestore}>
                        <Icon path={mdiBackupRestore} size="20px" aria-hidden />
                        Restore
                    </Button>
                )}
                <Button flex="1" size="lg" variant="outline" onClick={onClose}>
                    Close
                </Button>
            </Flex>
        </Stack>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <Flex gap="2">
            <Text as="dt" color="fg.muted" minW="24">
                {label}
            </Text>
            <Text as="dd" wordBreak="break-all">
                {value}
            </Text>
        </Flex>
    );
}

function FinishedJob({ job }: { job: RestoreJobDto }) {
    return (
        <Stack as="li" gap="2" py="4" borderTopWidth="1px">
            <Flex align="center" gap="2" wrap="wrap">
                <Badge colorPalette={STATUS_PALETTES[job.status]}>
                    {STATUS_LABELS[job.status]}
                </Badge>
            </Flex>
            <Text textStyle="sm" color="fg.muted" wordBreak="break-all">
                {formatTimestamp(job.startedAt ?? job.queuedAt)} ·{" "}
                {job.sourceName}
            </Text>
            {job.errorMessage && (
                <Text textStyle="sm" color="fg.error">
                    {job.errorMessage}
                </Text>
            )}
            {job.unrestoredFiles.length > 0 && (
                <UnrestoredFiles files={job.unrestoredFiles} />
            )}
            {job.problems.length > 0 && (
                <ProblemFiles problems={job.problems} />
            )}
        </Stack>
    );
}

function UnrestoredFiles({ files }: { files: UnrestoredFile[] }) {
    return (
        <Collapsible.Root>
            <Collapsible.Trigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    px="0"
                    color="fg.error"
                    css={{
                        "& [data-chevron]": { transition: "transform 0.2s" },
                        "&[data-state=open] [data-chevron]": {
                            transform: "rotate(180deg)"
                        }
                    }}>
                    {plural(files.length, "unrestored file", "unrestored files")}
                    <Box as="span" data-chevron display="inline-flex">
                        <Icon path={mdiChevronDown} size="18px" aria-hidden />
                    </Box>
                </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <Stack as="ul" gap="2" pt="1" listStyleType="none">
                    {files.map((file) => (
                        <Box as="li" key={file.fileId} textStyle="sm">
                            <Text fontWeight="medium" wordBreak="break-all">
                                {file.name}
                            </Text>
                            <Text color="fg.muted">{file.reason}</Text>
                        </Box>
                    ))}
                </Stack>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
