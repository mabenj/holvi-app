import { CollectionDto } from "@/lib/types/collection-dto";
import { Box, Flex, Spinner } from "@chakra-ui/react";
import { mdiCamera, mdiImageOutline, mdiVideo } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

export default function CollectionCardThumbnail({
    item,
    isHovering
}: {
    item: CollectionDto;
    isHovering: boolean;
}) {
    const [isLoading, setIsLoading] = useState(false);

    const thumbnailStoreRef = useRef(
        item.thumbnails[0] ? [item.thumbnails[0]] : []
    );
    const [thumbnailIndex, setThumbnailIndex] = useState(0);

    const timerRef = useRef(-1);
    const INTERVAL_MS = 500;

    const router = useRouter();

    useEffect(() => {
        if (!isHovering || isLoading) {
            window.clearTimeout(timerRef.current)
            setThumbnailIndex(0)
            return;
        } 
        updateThumbnailStore().then(() => thumbnailTick());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHovering, isLoading, item.thumbnails]);

    const thumbnailTick = () => {
        if(!isHovering || isLoading){
            window.clearTimeout(timerRef.current)
            setThumbnailIndex(0)
            return;
        }
        timerRef.current = window.setTimeout(() => {
            setThumbnailIndex((prev) =>
                prev + 1 >= thumbnailStoreRef.current.length ? 0 : prev + 1
            );
            thumbnailTick()
        }, INTERVAL_MS);
    };

    const updateThumbnailStore = async () => {
        if (
            thumbnailStoreRef.current.length > 1 ||
            item.thumbnails.length <= 1
        ) {
            return;
        }
        const promises = item.thumbnails.slice(1).map((url) =>
            fetch(url)
                .then((res) => res.blob())
                .then((blob) =>
                    (window.URL || window.webkitURL).createObjectURL(blob)
                )
                .catch((error) =>
                    console.error(`Could not fetch thumbnail '${url}'`, error)
                )
        );
        const blobs = await Promise.all(promises);
        thumbnailStoreRef.current = [
            ...thumbnailStoreRef.current,
            ...blobs.filter((blob) => !!blob).map((blob) => blob as string)
        ];
    };

    const handleClick = async () => {
        setIsLoading(true);
        await router.push(`/collections/${item.id}`);
        setIsLoading(false);
    };

    return (
        <>
            <Flex
                justifyContent="center"
                alignItems="center"
                w="100%"
                h="100%"
                onClick={handleClick}>
                {thumbnailStoreRef.current.length > 0 && (
                    <Box w="100%" h="100%" position="relative">
                        <Image
                            src={thumbnailStoreRef.current[thumbnailIndex]}
                            alt={item.name}
                            fill
                            style={{
                                position: "absolute",
                                objectFit: "cover"
                            }}
                        />
                    </Box>
                )}
                {item.thumbnails.length === 0 && (
                    <Icon path={mdiImageOutline} size={4} />
                )}
                <Flex
                    fontSize={["xs", "xs", "sm", "md"]}
                    w="100%"
                    h="100%"
                    justifyContent="space-between"
                    alignItems="flex-end"
                    gap={2}
                    position="absolute"
                    pointerEvents="none"
                    py={1}
                    px={2}
                    bottom={0}
                    left={0}
                    color="#fff"
                    backgroundImage={`linear-gradient(
                        rgba(0, 0, 0, 0.0) 80%,
                        rgba(0, 0, 0, 0.9) 100%
                    )`}
                    style={{
                        textShadow: `-1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        -1px 1px 0 rgba(0, 0, 0, 0.4), 
                                        1px 1px 0 rgba(0, 0, 0, 0.4)`
                    }}
                    opacity={isHovering ? 0 : 0.9}
                    transition="all 0.3s">
                    <Box
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis">
                        {item.name}
                    </Box>
                    <Flex alignItems="center" gap={2}>
                        {item.imageCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiCamera}
                                    size={0.7}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.imageCount}</span>
                            </Flex>
                        )}
                        {item.videoCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiVideo}
                                    size={0.7}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.videoCount}</span>
                            </Flex>
                        )}
                    </Flex>
                </Flex>
            </Flex>
            {isLoading && (
                <Spinner
                    position="absolute"
                    top="50%"
                    left="50%"
                    color="whiteAlpha.800"
                />
            )}
        </>
    );
}
