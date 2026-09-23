import { Flex, Text } from "@chakra-ui/react";
import { mdiTrayArrowDown } from "@mdi/js";
import Icon from "@mdi/react";

/** Covers the screen while files are dragged over it, saying what dropping them will do */
export default function DropOverlay({
    visible,
    label
}: {
    visible: boolean;
    label: string;
}) {
    if (!visible) return null;
    return (
        <Flex
            position="fixed"
            inset="3"
            zIndex="overlay"
            direction="column"
            alignItems="center"
            justifyContent="center"
            gap="3"
            rounded="2xl"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="border.emphasized"
            bg="bg/85"
            backdropFilter="blur(4px)"
            // Drag events must reach the window, not stop at the overlay
            pointerEvents="none">
            <Icon path={mdiTrayArrowDown} size="48px" aria-hidden />
            <Text textStyle="lg" fontWeight="semibold">
                {label}
            </Text>
        </Flex>
    );
}
