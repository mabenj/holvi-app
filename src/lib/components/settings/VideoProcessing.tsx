import { processVideos } from "@/lib/client/video-processing";
import { getErrorMessage } from "@/lib/common/utilities";
import {
    isVideoProcessingActive,
    useVideoProcessing
} from "@/lib/hooks/useVideoProcessing";
import { VideoProcessingStatus } from "@/lib/types/video-processing-status";
import {
    Box,
    Button,
    Flex,
    Progress,
    SimpleGrid,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiMovieCogOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";

const COUNTS: { key: keyof Omit<VideoProcessingStatus, "currentFile">; label: string; color?: string }[] = [
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
