import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import { Box, Flex } from "@chakra-ui/react";
import { mdiPlayCircle } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";

export default function VideoCardThumbnail({
    item
}: {
    item: CollectionFileDto;
}) {
    const router = useRouter();

    const handleClick = () => {
        router.push(
            {
                pathname: window.location.pathname,
                query: {
                    photoId: item.id
                }
            },
            undefined,
            { shallow: true }
        );
    };

    return (
        <Box onClick={handleClick}>
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
                fontSize={["xs", "xs", "sm", "md"]}
                gap={2}
                position="absolute"
                pointerEvents="none"
                p={1}
                color="whiteAlpha.800">
                <Icon
                    path={mdiPlayCircle}
                    size={0.7}
                    style={{
                        filter: "drop-shadow(0 0 2px black)"
                    }}
                />
                {item.durationInSeconds && (
                    <Box
                        style={{
                            textShadow: `-1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        -1px 1px 0 rgba(0, 0, 0, 0.4), 
                                        1px 1px 0 rgba(0, 0, 0, 0.4)`
                        }}>
                        {secondsToDuration(item.durationInSeconds)}
                    </Box>
                )}
            </Flex>
        </Box>
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
