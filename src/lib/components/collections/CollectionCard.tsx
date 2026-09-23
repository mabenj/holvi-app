import { useCyclingThumbnail } from "@/lib/hooks/useCyclingThumbnail";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, chakra, Flex, Heading } from "@chakra-ui/react";
import { mdiCamera, mdiImageOutline, mdiVideo } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import NextLink from "next/link";
import { memo } from "react";

const CardLink = chakra(NextLink);

const TEXT_OUTLINE = `-1px -1px 0 rgba(0, 0, 0, 0.4),
    1px -1px 0 rgba(0, 0, 0, 0.4),
    -1px 1px 0 rgba(0, 0, 0, 0.4),
    1px 1px 0 rgba(0, 0, 0, 0.4)`;
const ICON_SHADOW = "drop-shadow(0 0 2px black)";
const OVERLAY_FONT_SIZE = ["x-small", "x-small", "xs", "sm"];
/** Where hover cycles a card, its name and counts fade out of the way, as before */
const HOVER_CYCLING = "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

interface CollectionCardProps {
    collection: CollectionSummary;
    /** The frame the card's thumbnail cycling is on, or null while it is still */
    frame?: number | null;
    onHoverChange?: (collectionId: string, hovering: boolean) => void;
}

/**
 * A collection's tile: the Cover cropped to fill it, with its name and counts
 * over a bottom gradient. While cycling, it steps through its thumbnails.
 */
function CollectionCard({
    collection,
    frame = null,
    onHoverChange
}: CollectionCardProps) {
    const { cover } = collection;
    const shown = useCyclingThumbnail(collection.thumbnails, frame);
    return (
        <CardLink
            href={`/collections/${collection.id}`}
            className="group"
            onMouseEnter={() => onHoverChange?.(collection.id, true)}
            onMouseLeave={() => onHoverChange?.(collection.id, false)}
            display="flex"
            alignItems="center"
            justifyContent="center"
            position="relative"
            w="100%"
            h="100%"
            overflow="hidden"
            bg="bg.muted"
            color="fg.muted"
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "colorPalette.focusRing",
                outlineOffset: "-2px"
            }}>
            {cover ? (
                <Image
                    src={cover.thumbnailSrc}
                    alt={collection.name}
                    fill
                    // Thumbnails are small already, and decrypted content must
                    // not be written to Next.js's image cache
                    unoptimized
                    placeholder={cover.blurDataUrl ? "blur" : "empty"}
                    blurDataURL={cover.blurDataUrl ?? undefined}
                    style={{ objectFit: "cover" }}
                />
            ) : (
                <Icon path={mdiImageOutline} size="48px" aria-hidden />
            )}
            {shown > 0 && (
                // Preloaded, so the browser shows it from its caches
                <Image
                    src={collection.thumbnails[shown]}
                    alt=""
                    fill
                    unoptimized
                    style={{ objectFit: "cover" }}
                />
            )}
            <Flex
                position="absolute"
                inset="0"
                justifyContent="space-between"
                alignItems="flex-end"
                gap="2"
                py="1"
                px="2"
                pointerEvents="none"
                color="white"
                opacity={0.9}
                backgroundImage="linear-gradient(rgba(0, 0, 0, 0) 80%, rgba(0, 0, 0, 0.9) 100%)"
                transition="opacity 0.3s"
                css={{ [HOVER_CYCLING]: { ".group:hover &": { opacity: 0 } } }}
                style={{ textShadow: TEXT_OUTLINE }}>
                <Heading
                    as="h2"
                    m="0"
                    fontSize={OVERLAY_FONT_SIZE}
                    fontWeight="semibold"
                    lineHeight="short"
                    whiteSpace="nowrap"
                    overflow="hidden"
                    textOverflow="ellipsis">
                    {collection.name}
                </Heading>
                <Flex
                    direction="column"
                    alignItems="flex-end"
                    gap="1"
                    flexShrink={0}
                    fontSize={OVERLAY_FONT_SIZE}>
                    {collection.videoCount > 0 && (
                        <Count
                            icon={mdiVideo}
                            count={collection.videoCount}
                            label="videos"
                        />
                    )}
                    {collection.imageCount > 0 && (
                        <Count
                            icon={mdiCamera}
                            count={collection.imageCount}
                            label="photos"
                        />
                    )}
                </Flex>
            </Flex>
        </CardLink>
    );
}

export default memo(CollectionCard);

function Count({
    icon,
    count,
    label
}: {
    icon: string;
    count: number;
    label: string;
}) {
    return (
        <Flex alignItems="center" gap="1" aria-label={`${count} ${label}`}>
            <Icon
                path={icon}
                size="12px"
                // A fresh object: @mdi/react writes the size into its style
                style={{ filter: ICON_SHADOW }}
                aria-hidden
            />
            <Box as="span" aria-hidden>
                {count}
            </Box>
        </Flex>
    );
}
