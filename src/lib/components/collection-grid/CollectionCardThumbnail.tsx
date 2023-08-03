import { useRotatingThumbnail } from "@/lib/hooks/useRotatingThumbnail";
import { CollectionDto } from "@/lib/types/collection-dto";
import { Link } from "@chakra-ui/next-js";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { mdiCamera, mdiImageOutline, mdiVideo } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function CollectionCardThumbnail({
    item
}: {
    item: CollectionDto;
}) {
    const [isHovering, setIsHovering] = useState(false);
    const { thumbnail, startRotating, stopRotating } = useRotatingThumbnail(
        item.thumbnails
    );

    useEffect(() => {
        if (!isHovering) {
            stopRotating();
            return;
        }
        startRotating();

        return () => stopRotating();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHovering, item.thumbnails]);

    return (
        <Link href={`/collections/${item.id}`}>
            <Flex
                justifyContent="center"
                alignItems="center"
                w="100%"
                h="100%"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}>
                {item.thumbnails.length > 0 && (
                    <Box w="100%" h="100%" position="relative">
                        <Image
                            src={thumbnail || item.thumbnails[0]}
                            alt={item.name}
                            placeholder={item.blurDataUrl ? "blur" : undefined}
                            blurDataURL={item.blurDataUrl || undefined}
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
                    <Heading
                        p={0}
                        m={0}
                        size="xs"
                        fontSize={["x-small", "x-small", "xs", "sm"]}
                        fontWeight="semibold"
                        display="inline"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis">
                        {item.name}
                    </Heading>
                    <Flex
                        direction="column"
                        alignItems="flex-end"
                        gap={1}
                        fontSize={["x-small", "x-small", "xs", "sm"]}>
                        {item.videoCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiVideo}
                                    size={0.5}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.videoCount}</span>
                            </Flex>
                        )}
                        {item.imageCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiCamera}
                                    size={0.5}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.imageCount}</span>
                            </Flex>
                        )}
                    </Flex>
                </Flex>
            </Flex>
        </Link>
    );
}
