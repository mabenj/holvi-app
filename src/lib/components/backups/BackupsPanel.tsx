import { formatBytes } from "@/lib/common/utilities";
import { useBackups } from "@/lib/hooks/useBackups";
import {
    BackupJobDto,
    BackupJobStatus,
    BackupProblem,
    isActiveBackupJobStatus,
    isCurrentBackup
} from "@/lib/types/backup-job-dto";
import {
    Badge,
    Button,
    Collapse,
    Flex,
    Heading,
    IconButton,
    ListItem,
    Progress,
    Spinner,
    Text,
    UnorderedList,
    useDisclosure
} from "@chakra-ui/react";
import {
    mdiBackupRestore,
    mdiCancel,
    mdiDelete,
    mdiDownload
} from "@mdi/js";
import Icon from "@mdi/react";
import AreYouSureDialog from "../ui/AreYouSureDialog";
import Dialog from "../ui/Dialog";

const STATUS_LABELS: Record<BackupJobStatus, string> = {
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    completedWithErrors: "Completed with errors",
    failed: "Failed",
    cancelled: "Cancelled"
};

export default function BackupsPanel() {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <Dialog
            isOpen={isOpen}
            onOpen={onOpen}
            onClose={onClose}
            title={
                <Heading size="lg" mb={10} mx="auto" textAlign="center">
                    Backups
                </Heading>
            }
            trigger={
                <IconButton
                    variant="ghost"
                    aria-label="Backups"
                    title="Backups"
                    icon={<Icon path={mdiBackupRestore} size={1} />}
                />
            }>
            {/* Mounted only while open, so jobs are only fetched and polled while visible */}
            {isOpen && <BackupsPanelContent />}
        </Dialog>
    );
}

function BackupsPanelContent() {
    const {
        jobs,
        isLoading,
        isStarting,
        isCancelling,
        isDeleting,
        startBackup,
        cancelBackup,
        deleteBackup
    } = useBackups();
    const activeJob = jobs.find((job) => isActiveBackupJobStatus(job.status));
    const finishedJobs = jobs.filter(
        (job) => !isActiveBackupJobStatus(job.status)
    );

    if (isLoading) {
        return (
            <Flex justifyContent="center" py={4}>
                <Spinner />
            </Flex>
        );
    }

    return (
        <Flex direction="column" gap={6}>
            <Text>
                A backup is a single zip file with all your collections and
                files, decrypted. It is built in the background, so you can
                close this panel while it runs. Only your newest backup is kept.
            </Text>
            {activeJob ? (
                <ActiveJob
                    job={activeJob}
                    onCancel={() => cancelBackup(activeJob.id)}
                    isCancelling={isCancelling}
                />
            ) : (
                <Button
                    leftIcon={<Icon path={mdiBackupRestore} size={1} />}
                    onClick={startBackup}
                    isLoading={isStarting}>
                    Start backup
                </Button>
            )}
            {finishedJobs.length > 0 && (
                <Flex direction="column" gap={4}>
                    <Heading size="md">History</Heading>
                    {finishedJobs.map((job) => (
                        <FinishedJob
                            key={job.id}
                            job={job}
                            onDelete={() => deleteBackup(job.id)}
                            isDeleting={isDeleting}
                        />
                    ))}
                </Flex>
            )}
        </Flex>
    );
}

function ActiveJob({
    job,
    onCancel,
    isCancelling
}: {
    job: BackupJobDto;
    onCancel: () => void;
    isCancelling: boolean;
}) {
    const { progress } = job;
    return (
        <Flex direction="column" gap={3}>
            <Heading size="md">{STATUS_LABELS[job.status]}</Heading>
            {job.status === "queued" && (
                <Text fontSize="sm" color="gray.500">
                    Only one backup runs on the server at a time. This one
                    starts when the backups ahead of it have finished.
                </Text>
            )}
            {job.status === "running" && (
                <>
                    <ProgressRow
                        label={`Files ${progress.filesDone} / ${progress.filesTotal}`}
                        done={progress.filesDone}
                        total={progress.filesTotal}
                    />
                    <ProgressRow
                        label={`${formatBytes(progress.bytesDone)} / ${formatBytes(
                            progress.bytesTotal
                        )}`}
                        done={progress.bytesDone}
                        total={progress.bytesTotal}
                    />
                    <Text fontSize="sm" color="gray.500">
                        Collections {progress.collectionsDone} /{" "}
                        {progress.collectionsTotal}
                        {progress.currentFileName &&
                            ` · ${progress.currentFileName}`}
                    </Text>
                </>
            )}
            <Button
                leftIcon={<Icon path={mdiCancel} size={1} />}
                onClick={onCancel}
                isLoading={isCancelling}
                variant="outline"
                colorScheme="red">
                Cancel backup
            </Button>
        </Flex>
    );
}

function ProgressRow({
    label,
    done,
    total
}: {
    label: string;
    done: number;
    total: number;
}) {
    return (
        <Flex direction="column" gap={1}>
            <Text fontSize="sm">{label}</Text>
            <Progress
                value={total > 0 ? (done / total) * 100 : 0}
                borderRadius="full"
            />
        </Flex>
    );
}

function FinishedJob({
    job,
    onDelete,
    isDeleting
}: {
    job: BackupJobDto;
    onDelete: () => Promise<void>;
    isDeleting: boolean;
}) {
    // Only the Current backup still has a zip to download or delete
    const hasBackup = isCurrentBackup(job);
    return (
        <Flex direction="column" gap={2} borderTopWidth="1px" pt={3}>
            <Flex alignItems="center" gap={2} flexWrap="wrap">
                <Text fontWeight="semibold">{STATUS_LABELS[job.status]}</Text>
                {hasBackup && (
                    <Badge colorScheme="green">Current backup</Badge>
                )}
            </Flex>
            <Text fontSize="sm" color="gray.500">
                {formatTimestamp(job.startedAt ?? job.queuedAt)} –{" "}
                {formatTimestamp(job.finishedAt)}
                {job.zipSizeBytes !== null &&
                    ` · ${formatBytes(job.zipSizeBytes)}`}
            </Text>
            {job.errorMessage && <Text color="red.400">{job.errorMessage}</Text>}
            {job.problems.length > 0 && (
                <ProblemList
                    problems={job.problems}
                    skippedCount={job.skippedCount}
                    damagedCount={job.damagedCount}
                />
            )}
            {hasBackup && (
                <Flex gap={2} flexWrap="wrap">
                    <Button
                        as="a"
                        href={`/api/backups/${job.id}/download`}
                        leftIcon={<Icon path={mdiDownload} size={1} />}
                        colorScheme="blue">
                        Download
                    </Button>
                    <AreYouSureDialog
                        trigger={
                            <Button
                                leftIcon={<Icon path={mdiDelete} size={1} />}
                                variant="outline"
                                colorScheme="red">
                                Delete
                            </Button>
                        }
                        header="Delete backup"
                        isConfirming={isDeleting}
                        onConfirm={onDelete}
                        confirmLabel="Delete">
                        <Text>
                            This deletes the decrypted zip from the server. Your
                            collections and files stay in Holvi.
                        </Text>
                    </AreYouSureDialog>
                </Flex>
            )}
        </Flex>
    );
}

function formatTimestamp(epochMs: number | null) {
    return epochMs === null ? "—" : new Date(epochMs).toLocaleString();
}

function ProblemList({
    problems,
    skippedCount,
    damagedCount
}: {
    problems: BackupProblem[];
    skippedCount: number;
    damagedCount: number;
}) {
    const { isOpen, onToggle } = useDisclosure();
    return (
        <Flex direction="column" gap={2}>
            <Text color="orange.400">
                {problems.length} problem{problems.length === 1 ? "" : "s"} (
                {skippedCount} skipped, {damagedCount} damaged)
            </Text>
            <Button size="sm" variant="outline" onClick={onToggle}>
                {isOpen ? "Hide problems" : "Show problems"}
            </Button>
            <Collapse in={isOpen} animateOpacity>
                <UnorderedList spacing={1} fontSize="sm">
                    {problems.map((problem) => (
                        <ListItem key={problem.fileId}>
                            <Text as="span" fontWeight="semibold">
                                {problem.name}
                            </Text>{" "}
                            · {problem.kind === "skipped" ? "Skipped" : "Damaged"}{" "}
                            · {problem.reason}
                            {problem.kind === "damaged" &&
                                ` · ${formatBytes(problem.bytesWritten ?? 0)} of ${
                                    problem.bytesExpected === null
                                        ? "unknown size"
                                        : formatBytes(problem.bytesExpected)
                                } written`}
                        </ListItem>
                    ))}
                </UnorderedList>
            </Collapse>
        </Flex>
    );
}
