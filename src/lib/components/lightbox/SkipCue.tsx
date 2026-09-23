import { Box, Flex, Text } from "@chakra-ui/react";
import { mdiFastForward10, mdiRewind10 } from "@mdi/js";
import Icon from "@mdi/react";
import type { SkipDirection } from "./usePlayerShortcuts";
import { SKIP_SECONDS } from "./video-player";

/**
 * A ripple over the side of the video a double tap skipped on, which fades
 * by itself. Give it a new `key` for each skip, so the ripple starts over.
 */
export default function SkipCue({ direction }: { direction: SkipDirection }) {
    const back = direction === "back";
    return (
        <Flex
            position="absolute"
            insetY="0"
            {...(back ? { left: "0" } : { right: "0" })}
            w="33%"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
            pointerEvents="none"
            color="white"
            // Above the slides, beneath the controls
            zIndex="5"
            animation="fade-out 0.4s ease-in 0.35s forwards"
            aria-hidden>
            <Box
                position="absolute"
                top="50%"
                {...(back ? { right: "0" } : { left: "0" })}
                boxSize="200vh"
                maxW="none"
                transform="translateY(-50%)"
                rounded="full"
                bg="whiteAlpha.200"
                animation="scale-in 0.3s ease-out"
            />
            <Flex
                direction="column"
                alignItems="center"
                gap="1"
                textShadow="0 1px 2px rgba(0, 0, 0, 0.6)">
                <Icon
                    path={back ? mdiRewind10 : mdiFastForward10}
                    size="40px"
                />
                <Text fontSize="sm" fontWeight="medium">
                    {back ? "−" : "+"}
                    {SKIP_SECONDS} s
                </Text>
            </Flex>
        </Flex>
    );
}
