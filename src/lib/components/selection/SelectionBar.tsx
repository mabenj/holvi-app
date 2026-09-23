import { getErrorMessage, plural } from "@/lib/common/utilities";
import ConfirmationSurface from "@/lib/components/surfaces/ConfirmationSurface";
import { Box, chakra, Flex, IconButton, Text } from "@chakra-ui/react";
import {
    mdiClose,
    mdiDeleteOutline,
    mdiPencilOutline,
    mdiTagMultipleOutline
} from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useState } from "react";
import { TAB_BAR_HEIGHT } from "../theme/system";

interface SelectionBarProps {
    /** How many collections or files are selected */
    count: number;
    /** What the selected things are called, e.g. ["collection", "collections"] */
    noun: [one: string, many: string];
    /** Leaves selection mode */
    onExit: () => void;
    /** Deletes the selection once the user has confirmed; throws to show why it failed */
    onDelete: () => Promise<void>;
    /** What deleting also deletes, e.g. the collections' files */
    deleteWarning?: string;
    /** Edits the selected collection or file; offered only while exactly one is selected */
    onEdit: () => void;
    /** Opens the bulk-tag sheet */
    onTag: () => void;
    /** Whether Escape leaves selection mode now; off while an editor or sheet opened from the bar shows, since Escape closes that */
    escapeLeaves: boolean;
}

/**
 * The contextual bar that replaces the tab bar while selecting: the count,
 * and delete (with confirmation), edit (exactly one selected) and bulk tag.
 * Escape leaves selection mode, as Back does.
 */
export default function SelectionBar({
    count,
    noun,
    onExit,
    onDelete,
    deleteWarning,
    onEdit,
    onTag,
    escapeLeaves
}: SelectionBarProps) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const named = plural(count, ...noun);

    useEffect(() => {
        if (!escapeLeaves || confirming) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) onExit();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [escapeLeaves, confirming, onExit]);

    const confirmDelete = async () => {
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
            setConfirming(false);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Box
                as="nav"
                aria-label="Selection"
                position="fixed"
                insetX={0}
                bottom={0}
                zIndex="sticky"
                bg="bg.panel"
                borderTopWidth="1px"
                borderColor="border"
                pb="env(safe-area-inset-bottom)"
                pl="env(safe-area-inset-left)"
                pr="env(safe-area-inset-right)">
                <Flex h={TAB_BAR_HEIGHT} maxW="lg" mx="auto" alignItems="center" px="1">
                    <IconButton
                        aria-label="Leave selection"
                        variant="ghost"
                        rounded="full"
                        onClick={onExit}>
                        <Icon path={mdiClose} size="24px" aria-hidden />
                    </IconButton>
                    <Text
                        flex="1"
                        px="2"
                        fontWeight="semibold"
                        truncate
                        aria-live="polite">
                        {count} selected
                    </Text>
                    <BarAction
                        label="Tag"
                        icon={mdiTagMultipleOutline}
                        onClick={onTag}
                    />
                    {count === 1 && (
                        <BarAction
                            label="Edit"
                            icon={mdiPencilOutline}
                            onClick={onEdit}
                        />
                    )}
                    <BarAction
                        label="Delete"
                        icon={mdiDeleteOutline}
                        onClick={() => setConfirming(true)}
                        destructive
                    />
                </Flex>
            </Box>
            <ConfirmationSurface
                open={confirming}
                onClose={() => {
                    setConfirming(false);
                    setError(null);
                }}
                title={`Delete ${named}?`}
                description={
                    error ??
                    `${deleteWarning ?? `The selected ${count === 1 ? noun[0] : noun[1]} will be deleted.`} This cannot be undone.`
                }
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                destructive
                confirming={deleting}
            />
        </>
    );
}

const ActionButton = chakra("button");

/** An action in the bar: its icon over a short label, like the tabs it replaces */
function BarAction({
    label,
    icon,
    onClick,
    destructive = false
}: {
    label: string;
    icon: string;
    onClick: () => void;
    destructive?: boolean;
}) {
    return (
        <ActionButton
            type="button"
            onClick={onClick}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="0.5"
            h="100%"
            minW="16"
            px="2"
            cursor="pointer"
            color={destructive ? "fg.error" : "fg"}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "colorPalette.focusRing",
                outlineOffset: "-2px"
            }}>
            <Icon path={icon} size="24px" aria-hidden />
            <Text as="span" textStyle="2xs" fontWeight="medium">
                {label}
            </Text>
        </ActionButton>
    );
}
