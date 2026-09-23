import { TAB_BAR_HEIGHT } from "@/lib/components/theme/system";
import { Upload } from "@/lib/hooks/useUpload";
import {
    Box,
    CloseButton,
    Flex,
    Progress,
    Spinner,
    Stack,
    Text
} from "@chakra-ui/react";
import { useEffect } from "react";

/** How long a clean upload's result stays before it goes by itself */
const DONE_VISIBLE_MS = 4000;
/** Room kept free on the right for the floating action button */
const FLOATING_ACTION_ROOM = "calc(1rem + 64px + 0.75rem)";

interface UploadStatusProps {
    upload: Upload | null;
    onDismiss: () => void;
}

/**
 * The progress of the upload into the collection, above the tab bar, and then
 * how it went. Stays while the upload runs; problems stay until dismissed.
 */
export default function UploadStatus({ upload, onDismiss }: UploadStatusProps) {
    const cleanlyDone =
        upload?.status === "done" && upload.errors.length === 0;
    useEffect(() => {
        if (!cleanlyDone) return;
        const timer = setTimeout(onDismiss, DONE_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [cleanlyDone, onDismiss]);

    if (!upload) return null;
    const files = (count: number) => (count === 1 ? "1 file" : `${count} files`);
    const dismissable = upload.status === "done" || upload.status === "failed";

    return (
        <Box
            role="status"
            aria-live="polite"
            position="fixed"
            zIndex="sticky"
            left="calc(1rem + env(safe-area-inset-left))"
            right={`calc(${FLOATING_ACTION_ROOM} + env(safe-area-inset-right))`}
            bottom={`calc(${TAB_BAR_HEIGHT} + 1rem + env(safe-area-inset-bottom))`}
            maxW="sm"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            shadow="lg"
            px="4"
            py="3">
            <Flex alignItems="flex-start" gap="2">
                <Stack gap="2" flex="1" minW="0">
                    {upload.status === "uploading" && (
                        <>
                            <Text textStyle="sm" fontWeight="medium">
                                Uploading {files(upload.fileCount)} ·{" "}
                                {Math.floor(upload.progress * 100)}%
                            </Text>
                            <Progress.Root
                                value={Math.floor(upload.progress * 100)}
                                size="xs">
                                <Progress.Track>
                                    <Progress.Range />
                                </Progress.Track>
                            </Progress.Root>
                        </>
                    )}
                    {upload.status === "processing" && (
                        <Flex alignItems="center" gap="2">
                            <Spinner size="xs" />
                            <Text textStyle="sm" fontWeight="medium">
                                Processing {files(upload.fileCount)}…
                            </Text>
                        </Flex>
                    )}
                    {upload.status === "done" && (
                        <>
                            <Text textStyle="sm" fontWeight="medium">
                                {upload.added === 0
                                    ? "No files added"
                                    : `${files(upload.added)} added`}
                            </Text>
                            {upload.errors.length > 0 && (
                                <Box
                                    as="ul"
                                    maxH="32"
                                    overflowY="auto"
                                    textStyle="xs"
                                    color="fg.muted"
                                    listStyleType="disc"
                                    pl="4">
                                    {upload.errors.map((error, i) => (
                                        <li key={i}>{error}</li>
                                    ))}
                                </Box>
                            )}
                        </>
                    )}
                    {upload.status === "failed" && (
                        <Text textStyle="sm" color="fg.error">
                            {upload.error}
                        </Text>
                    )}
                </Stack>
                {dismissable && (
                    <CloseButton
                        size="2xs"
                        aria-label="Dismiss"
                        onClick={onDismiss}
                    />
                )}
            </Flex>
        </Box>
    );
}
