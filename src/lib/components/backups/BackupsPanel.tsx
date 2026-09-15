import { useBackups } from "@/lib/hooks/useBackups";
import {
    BackupJobDto,
    BackupJobStatus,
    BackupProblem,
    isActiveBackupJobStatus,
    isCompletedBackupJobStatus
} from "@/lib/types/backup-job-dto";
import {
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
import { mdiBackupRestore, mdiDownload } from "@mdi/js";
import Icon from "@mdi/react";
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
    const { jobs, isLoading, isStarting, startBackup } = useBackups();
    const activeJob = jobs.find((job) => isActiveBackupJobStatus(job.status));
    const lastFinishedJob = jobs.find(
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
                close this panel while it runs.
            </Text>
            {activeJob ? (
                <ActiveJob job={activeJob} />
            ) : (
                <Button
                    leftIcon={<Icon path={mdiBackupRestore} size={1} />}
                    onClick={startBackup}
                    isLoading={isStarting}>
                    Start backup
                </Button>
            )}
            {lastFinishedJob && <FinishedJob job={lastFinishedJob} />}
        </Flex>
    );
}

function ActiveJob({ job }: { job: BackupJobDto }) {
    const { progress } = job;
    return (
        <Flex direction="column" gap={3}>
            <Heading size="md">{STATUS_LABELS[job.status]}</Heading>
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

function FinishedJob({ job }: { job: BackupJobDto }) {
    const finishedAt = job.finishedAt
        ? new Date(job.finishedAt).toLocaleString()
        : null;
    const hasBackup = isCompletedBackupJobStatus(job.status);
    return (
        <Flex direction="column" gap={2}>
            <Heading size="md">
                {hasBackup ? "Current backup" : "Last backup job"}
            </Heading>
            <Text>
                {STATUS_LABELS[job.status]}
                {finishedAt && ` · ${finishedAt}`}
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
                <Button
                    as="a"
                    href={`/api/backups/${job.id}/download`}
                    leftIcon={<Icon path={mdiDownload} size={1} />}
                    colorScheme="blue">
                    Download
                </Button>
            )}
        </Flex>
    );
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

function formatBytes(bytes: number) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
