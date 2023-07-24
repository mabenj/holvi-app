import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { Box, Flex } from "@chakra-ui/react";
import { mdiPlayCircle } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { Photo } from "../photo-viewer/PhotoViewer";

export default function VideoCardThumbnail({
    item
}: {
    item: CollectionFileDto;
}) {
    return (
        <Photo id={item.id}>
            <Image
                src={item.thumbnailSrc!}
                alt={item.name}
                fill
                style={{
                    objectFit: "cover"
                }}
            />
            <Flex
                alignItems="center"
                gap={2}
                position="absolute"
                pointerEvents="none"
                p={1}
                color="whiteAlpha.800">
                <Icon
                    path={mdiPlayCircle}
                    size={1}
                    style={{
                        filter: "drop-shadow(0 0 2px black)"
                    }}
                />
                {item.durationInSeconds && (
                    <Box
                        fontSize="sm"
                        style={{
                            textShadow: `-1px -1px 0 rgba(0, 0, 0, 0.6), 
                                        1px -1px 0 rgba(0, 0, 0, 0.6), 
                                        -1px 1px 0 rgba(0, 0, 0, 0.6), 
                                        1px 1px 0 rgba(0, 0, 0, 0.6)`
                        }}>
                        {secondsToDuration(item.durationInSeconds)}
                    </Box>
                )}
            </Flex>
        </Photo>
    );
}

function secondsToDuration(seconds: number) {
    const ONE_HOUR = 3600;
    const startIndex = seconds < ONE_HOUR ? 14 : 11;
    const endIndex = seconds < ONE_HOUR ? 19 : 16;
    return new Date(seconds * 1000)
        .toISOString()
        .substring(startIndex, endIndex);
}
