import { Box, Button, chakra, Dialog, Portal, Stack, Text } from "@chakra-ui/react";
import { Drawer } from "vaul";
import { useIsPhone } from "../../hooks/useIsPhone";

const SheetOverlay = chakra(Drawer.Overlay);
const SheetContent = chakra(Drawer.Content);
const SheetTitle = chakra(Drawer.Title);
const SheetDescription = chakra(Drawer.Description);

interface ConfirmationSurfaceProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    confirmLabel: string;
    onConfirm: () => void;
    /** Styles the confirm action as destructive, e.g. for deletes */
    destructive?: boolean;
    confirming?: boolean;
}

/**
 * Surface for confirmations. A small bottom sheet on phones, within thumb
 * reach and dismissed by dragging down, and a centred dialog on desktop.
 */
export default function ConfirmationSurface(props: ConfirmationSurfaceProps) {
    const isPhone = useIsPhone();
    return isPhone ? (
        <ConfirmationSheet {...props} />
    ) : (
        <ConfirmationDialog {...props} />
    );
}

function ConfirmationSheet({
    open,
    onClose,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive,
    confirming
}: ConfirmationSurfaceProps) {
    return (
        <Drawer.Root
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Drawer.Portal>
                <SheetOverlay
                    position="fixed"
                    inset="0"
                    zIndex="overlay"
                    bg="blackAlpha.600"
                />
                <SheetContent
                    role="alertdialog"
                    data-surface="sheet"
                    position="fixed"
                    insetX="0"
                    bottom="0"
                    zIndex="modal"
                    bg="bg.panel"
                    roundedTop="2xl"
                    outline="none"
                    px="calc(1rem + env(safe-area-inset-left))"
                    pt="2"
                    pb="calc(1rem + env(safe-area-inset-bottom))">
                    <Box
                        aria-hidden
                        mx="auto"
                        mb="4"
                        w="10"
                        h="1"
                        rounded="full"
                        bg="border.emphasized"
                    />
                    <Stack gap="2" mb="5">
                        <SheetTitle textStyle="lg" fontWeight="semibold">
                            {title}
                        </SheetTitle>
                        {/* vaul warns when a sheet has no description */}
                        <SheetDescription
                            color="fg.muted"
                            srOnly={!description}>
                            {description || title}
                        </SheetDescription>
                    </Stack>
                    <Stack gap="2">
                        <Button
                            size="lg"
                            colorPalette={destructive ? "red" : undefined}
                            loading={confirming}
                            onClick={onConfirm}>
                            {confirmLabel}
                        </Button>
                        <Button size="lg" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                    </Stack>
                </SheetContent>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

function ConfirmationDialog({
    open,
    onClose,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive,
    confirming
}: ConfirmationSurfaceProps) {
    return (
        <Dialog.Root
            role="alertdialog"
            open={open}
            onOpenChange={(details) => !details.open && onClose()}
            placement="center"
            size="xs">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content data-surface="dialog">
                        <Dialog.Header>
                            <Dialog.Title>{title}</Dialog.Title>
                        </Dialog.Header>
                        {description && (
                            <Dialog.Body>
                                <Dialog.Description asChild>
                                    <Text color="fg.muted">{description}</Text>
                                </Dialog.Description>
                            </Dialog.Body>
                        )}
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                colorPalette={destructive ? "red" : undefined}
                                loading={confirming}
                                onClick={onConfirm}>
                                {confirmLabel}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
