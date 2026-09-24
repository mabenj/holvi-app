import { formatBytes, plural } from "@/lib/common/utilities";
import { useActivity } from "@/lib/hooks/useActivity";
import { isVideoProcessingActive } from "@/lib/hooks/useVideoProcessing";
import { BackupJobDto } from "@/lib/types/backup-job-dto";
import { VideoProcessingStatus } from "@/lib/types/video-processing-status";
import { Box, Flex, Progress, Spinner, Stack, Text } from "@chakra-ui/react";
import { mdiArchiveArrowDownOutline, mdiMovieCogOutline } from "@mdi/js";
import Icon from "@mdi/react";

/**
 * The Activity section of Settings: the user's running and queued background
 * work, with progress. Polls while anything is active.
 */
export default function Activity() {
    const { activity, error, isLoading } = useActivity();

    if (isLoading) {
        return (
            <Flex justify="center" py="4">
                <Spinner aria-label="Loading activity" />
            </Flex>
        );
    }
    if (error) {
        return (
            <Text textStyle="sm" color="fg.error">
                {error.message}
            </Text>
        );
    }
    if (!activity?.active) {
        return (
            <Text textStyle="sm" color="fg.muted">
                Nothing is running in the background.
            </Text>
        );
    }

    const { backupJob, videoProcessing } = activity;
    return (
        <Stack
            as="ul"
            gap="0"
            listStyleType="none"
            borderWidth="1px"
            rounded="lg"
            bg="bg.subtle"
            aria-label="Background work"
            aria-live="polite">
            {backupJob && <BackupActivity job={backupJob} />}
            {isVideoProcessingActive(videoProcessing) && (
                <VideoProcessingActivity status={videoProcessing} />
            )}
        </Stack>
    );
}

function BackupActivity({ job }: { job: BackupJobDto }) {
    const { progress } = job;
    if (job.status === "queued") {
        return (
            <ActivityItem
                icon={mdiArchiveArrowDownOutline}
                title="Backup queued"
                detail="Starts when the backups ahead of it have finished"
            />
        );
    }
    if (progress.filesTotal === 0) {
        // Running, but not done listing the files yet
        return (
            <ActivityItem
                icon={mdiArchiveArrowDownOutline}
                title="Backing up"
                detail="Starting"
            />
        );
    }
    return (
        <ActivityItem
            icon={mdiArchiveArrowDownOutline}
            title="Backing up"
            detail={`${progress.filesDone} of ${plural(
                progress.filesTotal,
                "file",
                "files"
            )} · ${formatBytes(progress.bytesDone)} of ${formatBytes(
                progress.bytesTotal
            )}`}
            done={progress.bytesDone}
            total={progress.bytesTotal}
            currentFile={progress.currentFileName}
        />
    );
}

function VideoProcessingActivity({
    status
}: {
    status: VideoProcessingStatus;
}) {
    const left = status.pending + status.processing;
    const finished = status.done + status.failed;
    return (
        <ActivityItem
            icon={mdiMovieCogOutline}
            title={status.processing > 0 ? "Processing videos" : "Videos queued"}
            detail={`${plural(left, "video", "videos")} left`}
            done={finished}
            total={finished + left}
            currentFile={status.currentFile?.name ?? null}
        />
    );
}

function ActivityItem({
    icon,
    title,
    detail,
    done,
    total,
    currentFile
}: {
    icon: string;
    title: string;
    detail: string;
    /** With total, shows a progress bar */
    done?: number;
    total?: number;
    currentFile?: string | null;
}) {
    return (
        <Flex
            as="li"
            gap="3"
            p="4"
            align="flex-start"
            _notFirst={{ borderTopWidth: "1px" }}>
            <Box color="fg.muted" flexShrink="0" pt="0.5">
                <Icon path={icon} size="20px" aria-hidden />
            </Box>
            <Stack gap="2" flex="1" minW="0">
                <Box>
                    <Text fontWeight="medium">{title}</Text>
                    <Text textStyle="sm" color="fg.muted">
                        {detail}
                    </Text>
                </Box>
                {done !== undefined && total !== undefined && (
                    <Progress.Root
                        value={total > 0 ? Math.min(100, (done / total) * 100) : 0}
                        size="xs"
                        aria-label={title}>
                        <Progress.Track rounded="full">
                            <Progress.Range />
                        </Progress.Track>
                    </Progress.Root>
                )}
                {currentFile && (
                    <Flex align="center" gap="2" minW="0">
                        <Spinner size="xs" flexShrink="0" />
                        <Text textStyle="sm" color="fg.muted" truncate>
                            {currentFile}
                        </Text>
                    </Flex>
                )}
            </Stack>
        </Flex>
    );
}
