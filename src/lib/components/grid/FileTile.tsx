import { FileSummary } from "@/lib/types/file-summary";
import { Box, Flex } from "@chakra-ui/react";
import { mdiPlay } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";

/** A file's thumbnail cropped to fill its tile; a video shows a play mark and its length */
export default function FileTile({ file }: { file: FileSummary }) {
    const isVideo = file.playbackSrc !== undefined;
    return (
        <Box
            position="relative"
            w="100%"
            h="100%"
            overflow="hidden"
            bg="bg.muted">
            <Image
                src={file.thumbnailSrc}
                alt={file.name}
                fill
                // Thumbnails are small already, and decrypted content must
                // not be written to Next.js's image cache
                unoptimized
                placeholder={file.blurDataUrl ? "blur" : "empty"}
                blurDataURL={file.blurDataUrl}
                style={{ objectFit: "cover" }}
            />
            {isVideo && (
                <Flex
                    position="absolute"
                    top="1"
                    right="1"
                    alignItems="center"
                    gap="0.5"
                    px="1"
                    rounded="sm"
                    bg="blackAlpha.600"
                    color="white"
                    fontSize="xs"
                    fontWeight="medium"
                    lineHeight="1.4">
                    <Icon path={mdiPlay} size="14px" aria-hidden />
                    {file.durationInSeconds !== undefined && (
                        <span>{formatDuration(file.durationInSeconds)}</span>
                    )}
                </Flex>
            )}
        </Box>
    );
}

/** m:ss, or h:mm:ss for an hour or more */
export function formatDuration(totalSeconds: number) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
