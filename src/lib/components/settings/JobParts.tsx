import { formatBytes } from "@/lib/common/utilities";
import { BackupProblem } from "@/lib/types/backup-job-dto";
import { JobProgress, JobStatus } from "@/lib/types/job-dto";
import {
    Box,
    Button,
    Collapsible,
    Flex,
    Progress,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiChevronDown, mdiClose } from "@mdi/js";
import Icon from "@mdi/react";
import { ReactNode } from "react";

// The parts the Backups and Restore sections of Settings share

export const STATUS_LABELS: Record<JobStatus, string> = {
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    completedWithErrors: "Completed with errors",
    failed: "Failed",
    cancelled: "Cancelled"
};

export const STATUS_PALETTES: Record<JobStatus, string> = {
    queued: "gray",
    running: "blue",
    completed: "green",
    completedWithErrors: "orange",
    failed: "red",
    cancelled: "gray"
};

const ACTIVE_JOB_TEXTS = {
    backup: {
        queued: "Backup queued",
        running: "Backing up",
        queuedNote:
            "Only one backup runs on the instance at a time. This one starts when the ones ahead of it have finished.",
        cancel: "Cancel backup"
    },
    restore: {
        queued: "Restore queued",
        running: "Restoring",
        queuedNote:
            "Only one Restore runs on the instance at a time. This one starts when the ones ahead of it have finished.",
        cancel: "Cancel restore"
    }
};

/** A queued or running job: its progress, and a button to cancel it */
export function ActiveJob({
    kind,
    job,
    cancelling,
    onCancel,
    children
}: {
    kind: keyof typeof ACTIVE_JOB_TEXTS;
    job: { status: JobStatus; progress: JobProgress };
    cancelling: boolean;
    onCancel: () => void;
    /** Shown below the progress */
    children?: ReactNode;
}) {
    const texts = ACTIVE_JOB_TEXTS[kind];
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
                    {job.status === "queued" ? texts.queued : texts.running}
                </Text>
            </Flex>
            {job.status === "queued" ? (
                <Text textStyle="sm" color="fg.muted">
                    {texts.queuedNote}
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
            {children}
            <Button
                variant="outline"
                size="lg"
                colorPalette="red"
                loading={cancelling}
                onClick={onCancel}>
                <Icon path={mdiClose} size="20px" aria-hidden />
                {texts.cancel}
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

/** A Backup's Problem files, collapsed behind how many are skipped and damaged */
export function ProblemFiles({ problems }: { problems: BackupProblem[] }) {
    const count = (kind: BackupProblem["kind"]) =>
        problems.filter((problem) => problem.kind === kind).length;
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
                    {problems.length === 1 ? "" : "s"} ({count("skipped")}{" "}
                    skipped, {count("damaged")} damaged)
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

export function formatTimestamp(epochMs: number) {
    return new Date(epochMs).toLocaleString();
}
