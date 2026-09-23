import { Box, Flex } from "@chakra-ui/react";
import { mdiCheck } from "@mdi/js";
import Icon from "@mdi/react";

/**
 * Laid over a tile while selecting: an empty circle, or a filled check with
 * the tile dimmed and outlined once it is selected. Its tile must be
 * positioned.
 */
export default function SelectionMark({ selected }: { selected: boolean }) {
    return (
        <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            zIndex="1"
            bg={selected ? "blackAlpha.400" : undefined}
            outline={selected ? "3px solid" : undefined}
            outlineColor="colorPalette.solid"
            outlineOffset="-3px"
            colorPalette="blue"
            data-selected={selected || undefined}>
            <Flex
                position="absolute"
                top="1.5"
                left="1.5"
                w="6"
                h="6"
                rounded="full"
                alignItems="center"
                justifyContent="center"
                borderWidth="2px"
                borderColor="white"
                bg={selected ? "colorPalette.solid" : "blackAlpha.300"}
                color="colorPalette.contrast"
                boxShadow="0 0 2px rgba(0, 0, 0, 0.6)">
                {selected && <Icon path={mdiCheck} size="16px" aria-hidden />}
            </Flex>
        </Box>
    );
}
