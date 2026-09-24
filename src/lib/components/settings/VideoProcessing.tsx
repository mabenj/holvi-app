import {
    FAILED_VIDEOS_URL,
    getFailedVideos,
    processVideos
} from "@/lib/client/video-processing";
import { getErrorMessage, plural } from "@/lib/common/utilities";
import { refreshActivity } from "@/lib/hooks/useActivity";
import { useVideoProcessing } from "@/lib/hooks/useVideoProcessing";
import {
    isVideoProcessingActive,
    FailedVideo,
    VideoProcessingStatus
} from "@/lib/types/video-processing-status";
import {
    Box,
    Button,
    Collapsible,
    Flex,
    Progress,
    SimpleGrid,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiChevronDown, mdiMovieCogOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import useSWR from "swr";

type StatusCount = keyof Omit<VideoProcessingStatus, "currentFile">;

const COUNTS: { key: StatusCount; label: string; color?: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "processing", label: "Processing" },
    { key: "done", label: "Done" },
    { key: "failed", label: "Failed", color: "fg.error" }
];

/**
 * The Video processing section of Settings: how far processing has got with
 * the user's videos, and "Process videos", which queues every video that was
 * never processed or whose processing failed.
 */
export default function VideoProcessing() {
    const { status, error, isLoading, update } = useVideoProcessing();
    const [starting, setStarting] = useState(false);
    const [actionError, setActionError] = useState<string>();

    const onProcess = async () => {
        setStarting(true);
        setActionError(undefined);
        try {
            await update(await processVideos());
            await refreshActivity();
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setStarting(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justify="center" py="4">
                <Spinner aria-label="Loading video processing" />
            </Flex>
        );
    }

    const active = status ? isVideoProcessingActive(status) : false;
    const total = status
        ? status.pending + status.processing + status.done + status.failed
        : 0;

    return (
        <Stack gap="5">
            <Text textStyle="sm" color="fg.muted">
                Videos your browser may not play, such as HEVC from iPhones, get
                a web-playable Rendition made in the background. Originals are
                never changed. New uploads are processed automatically.
            </Text>
            {error && (
                <Text textStyle="sm" color="fg.error">
                    {error.message}
                </Text>
            )}
            {status && total > 0 && (
                <Stack
                    gap="4"
                    p="4"
                    borderWidth="1px"
                    rounded="lg"
                    bg="bg.subtle"
                    aria-live="polite">
                    <SimpleGrid columns={4} gap="2">
                        {COUNTS.map(({ key, label, color }) => (
                            <Box key={key} textAlign="center" minW="0">
                                <Text
                                    textStyle="xl"
                                    fontWeight="semibold"
                                    color={status[key] > 0 ? color : undefined}>
                                    {status[key]}
                                </Text>
                                <Text textStyle="xs" color="fg.muted" truncate>
                                    {label}
                                </Text>
                            </Box>
                        ))}
                    </SimpleGrid>
                    {active && (
                        <Progress.Root
                            value={((status.done + status.failed) / total) * 100}
                            size="sm"
                            aria-label="Videos processed">
                            <Progress.Track rounded="full">
                                <Progress.Range />
                            </Progress.Track>
                        </Progress.Root>
                    )}
                    {status.currentFile && (
                        <Flex align="center" gap="2" minW="0">
                            <Spinner size="xs" flexShrink="0" />
                            <Text textStyle="sm" color="fg.muted" truncate>
                                {status.currentFile.name}
                            </Text>
                        </Flex>
                    )}
                    {status.failed > 0 && <FailedVideos count={status.failed} />}
                </Stack>
            )}
            <Button size="lg" loading={starting} onClick={onProcess}>
                <Icon path={mdiMovieCogOutline} size="20px" aria-hidden />
                Process videos
            </Button>
            {actionError && (
                <Text textStyle="sm" color="fg.error" role="alert">
                    {actionError}
                </Text>
            )}
        </Stack>
    );
}

/** The failed videos and their errors, loaded when opened. They still play from their originals. */
function FailedVideos({ count }: { count: number }) {
    const [open, setOpen] = useState(false);
    // Keyed by the count, so a video failing or being retried reloads the list
    const { data: videos, error } = useSWR<FailedVideo[], Error>(
        open ? [FAILED_VIDEOS_URL, count] : null,
        getFailedVideos
    );

    return (
        <Collapsible.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
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
                    {plural(count, "failed video", "failed videos")}
                    <Box as="span" data-chevron display="inline-flex">
                        <Icon path={mdiChevronDown} size="18px" aria-hidden />
                    </Box>
                </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <Stack gap="2" pt="1">
                    <Text textStyle="sm" color="fg.muted">
                        These still play from their originals. Process videos
                        tries them again.
                    </Text>
                    {error && (
                        <Text textStyle="sm" color="fg.error">
                            {error.message}
                        </Text>
                    )}
                    {!videos && !error && <Spinner size="sm" />}
                    {videos && (
                        <Stack as="ul" gap="2" listStyleType="none">
                            {videos.map((video) => (
                                <Box as="li" key={video.id} textStyle="sm">
                                    <Text
                                        fontWeight="medium"
                                        wordBreak="break-all">
                                        {video.name}
                                    </Text>
                                    <Text color="fg.muted" wordBreak="break-word">
                                        {video.error ?? "Unknown error"}
                                    </Text>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Stack>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
