import {
    Button,
    Circle,
    Flex,
    FlexProps,
    Float,
    IconButton,
    Text
} from "@chakra-ui/react";
import { mdiClose, mdiFilterVariant } from "@mdi/js";
import Icon from "@mdi/react";

/** Opens a filter panel; shows how many of its filters are on */
export function FilterButton({
    activeCount,
    onClick
}: {
    activeCount: number;
    onClick: () => void;
}) {
    return (
        <IconButton
            aria-label={activeCount > 0 ? `Filters, ${activeCount} on` : "Filters"}
            variant={activeCount > 0 ? "subtle" : "ghost"}
            position="relative"
            flexShrink="0"
            onClick={onClick}>
            <Icon path={mdiFilterVariant} size="24px" aria-hidden />
            {activeCount > 0 && (
                <Float placement="top-end" offset="1.5">
                    <Circle
                        size="4.5"
                        bg="colorPalette.solid"
                        color="colorPalette.contrast"
                        fontSize="2xs"
                        fontWeight="bold">
                        {activeCount}
                    </Circle>
                </Float>
            )}
        </IconButton>
    );
}

/**
 * The filters in effect as a row of chips (`FilterChip`s as children), led by
 * one that clears them all in one tap
 */
export function ActiveFilterChips({
    onClearAll,
    children,
    ...flexProps
}: FlexProps & { onClearAll: () => void }) {
    return (
        <Flex
            role="group"
            aria-label="Active filters"
            gap="1.5"
            overflowX="auto"
            alignItems="center"
            // Chips scroll sideways instead of wrapping into many rows
            css={{ scrollbarWidth: "none" }}
            {...flexProps}>
            <ClearFiltersChip onClear={onClearAll} />
            {children}
        </Flex>
    );
}

function ClearFiltersChip({ onClear }: { onClear: () => void }) {
    return (
        <Button
            size="xs"
            variant="solid"
            rounded="full"
            flexShrink="0"
            onClick={onClear}>
            <Icon path={mdiClose} size="14px" aria-hidden />
            Clear all
        </Button>
    );
}

/** One filter in effect; tapping it removes it */
export function FilterChip({
    label,
    removeLabel,
    onRemove
}: {
    label: string;
    removeLabel: string;
    onRemove: () => void;
}) {
    return (
        <Button
            size="xs"
            variant="subtle"
            rounded="full"
            flexShrink="0"
            maxW="60vw"
            aria-label={removeLabel}
            onClick={onRemove}>
            <Text as="span" truncate>
                {label}
            </Text>
            <Icon path={mdiClose} size="14px" aria-hidden />
        </Button>
    );
}
