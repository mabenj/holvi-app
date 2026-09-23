import { goBack } from "@/lib/client/navigation";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, Flex, Heading, IconButton, Skeleton, Text } from "@chakra-ui/react";
import { mdiArrowLeft, mdiImageOutline } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

/** Height of the compact title bar, not counting the safe-area inset above it */
export const TITLE_BAR_HEIGHT = "52px";
/** CSS variable with how far the hero has collapsed, from 0 to 1 */
const COLLAPSE = "--hero-collapse";
const HERO_HEIGHT = { base: "min(62vh, 440px)", md: "min(56vh, 520px)" };

interface CollectionHeroProps {
    /** Absent while the collection loads */
    collection: Pick<
        CollectionSummary,
        "name" | "cover" | "imageCount" | "videoCount"
    > | null;
}

/**
 * A large hero of the Cover with the collection's name over it. As the page
 * scrolls past it, a compact title bar with the name takes its place.
 */
export default function CollectionHero({ collection }: CollectionHeroProps) {
    const router = useRouter();
    const hero = useRef<HTMLDivElement>(null);
    const titleBar = useRef<HTMLDivElement>(null);
    const collapsed = useCollapse(hero, titleBar);
    const cover = collection?.cover;

    return (
        <>
            <Box
                ref={hero}
                position="relative"
                h={HERO_HEIGHT}
                overflow="hidden"
                bg="bg.muted">
                <Box
                    position="absolute"
                    inset="0"
                    // Drifts slower than the page as the hero collapses
                    style={{
                        transform: `translateY(calc(var(${COLLAPSE}, 0) * 35%))`
                    }}>
                    {!collection ? (
                        <Skeleton position="absolute" inset="0" rounded="none" />
                    ) : cover ? (
                        <Image
                            src={cover.thumbnailSrc}
                            alt=""
                            fill
                            priority
                            // Decrypted content must not be written to Next.js's image cache
                            unoptimized
                            placeholder={cover.blurDataUrl ? "blur" : "empty"}
                            blurDataURL={cover.blurDataUrl ?? undefined}
                            style={{ objectFit: "cover" }}
                        />
                    ) : (
                        <Flex
                            position="absolute"
                            inset="0"
                            alignItems="center"
                            justifyContent="center"
                            color="fg.subtle">
                            <Icon path={mdiImageOutline} size="64px" aria-hidden />
                        </Flex>
                    )}
                </Box>
                <Flex
                    position="absolute"
                    inset="0"
                    direction="column"
                    justifyContent="flex-end"
                    gap="1"
                    px="4"
                    pb="4"
                    color="white"
                    // Darkens the top for the back button and the bottom for the name
                    backgroundImage="linear-gradient(rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 22%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.8) 100%)">
                    {collection && (
                        <Box
                            // The name fades and shrinks into the title bar
                            transformOrigin="left bottom"
                            style={{
                                opacity: `calc(1 - var(${COLLAPSE}, 0))`,
                                transform: `scale(calc(1 - var(${COLLAPSE}, 0) * 0.2))`
                            }}>
                            <Heading
                                as="h1"
                                textStyle={{ base: "3xl", md: "4xl" }}
                                fontWeight="bold"
                                lineHeight="shorter"
                                lineClamp={3}
                                textShadow="0 1px 8px rgba(0, 0, 0, 0.5)">
                                {collection.name}
                            </Heading>
                            <Text textStyle="sm" opacity={0.85}>
                                {describeCounts(collection)}
                            </Text>
                        </Box>
                    )}
                </Flex>
            </Box>
            <Flex
                ref={titleBar}
                position="fixed"
                top="0"
                left="0"
                right="0"
                zIndex="sticky"
                alignItems="center"
                gap="1"
                h={`calc(${TITLE_BAR_HEIGHT} + env(safe-area-inset-top))`}
                pt="env(safe-area-inset-top)"
                pl="calc(0.25rem + env(safe-area-inset-left))"
                pr="calc(1rem + env(safe-area-inset-right))"
                bg={collapsed ? "bg.panel" : "transparent"}
                borderBottomWidth="1px"
                borderColor={collapsed ? "border.subtle" : "transparent"}
                color={collapsed ? "fg" : "white"}
                transition="background-color 0.2s, border-color 0.2s, color 0.2s">
                <IconButton
                    aria-label="Back"
                    variant="ghost"
                    color="inherit"
                    rounded="full"
                    _hover={{ bg: collapsed ? "bg.muted" : "blackAlpha.300" }}
                    onClick={() => goBack(router, "/")}>
                    <Icon
                        path={mdiArrowLeft}
                        size="24px"
                        style={{
                            filter: collapsed
                                ? undefined
                                : "drop-shadow(0 0 2px rgba(0, 0, 0, 0.6))"
                        }}
                        aria-hidden
                    />
                </IconButton>
                <Text
                    flex="1"
                    minW="0"
                    fontWeight="semibold"
                    truncate
                    opacity={collapsed ? 1 : 0}
                    transition="opacity 0.2s"
                    aria-hidden={!collapsed}>
                    {collection?.name}
                </Text>
            </Flex>
        </>
    );
}

function describeCounts({
    imageCount,
    videoCount
}: Pick<CollectionSummary, "imageCount" | "videoCount">) {
    const parts = [
        imageCount > 0 && `${imageCount} ${imageCount === 1 ? "photo" : "photos"}`,
        videoCount > 0 && `${videoCount} ${videoCount === 1 ? "video" : "videos"}`
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "No files yet";
}

/**
 * Tracks how far the hero has collapsed: from 0 at the top of the page to 1
 * once only the title bar's height of it is left. The progress goes into a CSS
 * variable on the hero, so scrolling does not re-render; the return value tells
 * whether the hero has collapsed completely.
 */
function useCollapse(
    hero: React.RefObject<HTMLElement | null>,
    titleBar: React.RefObject<HTMLElement | null>
) {
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const element = hero.current;
            if (!element) return;
            const { top, height } = element.getBoundingClientRect();
            const barHeight = titleBar.current?.offsetHeight ?? 0;
            const range = Math.max(1, height - barHeight);
            const progress = Math.min(1, Math.max(0, -top / range));
            element.style.setProperty(COLLAPSE, String(progress));
            setCollapsed(progress >= 1);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            cancelAnimationFrame(frame);
        };
    }, [hero, titleBar]);
    return collapsed;
}
