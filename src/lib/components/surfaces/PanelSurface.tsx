import {
    Box,
    Button,
    chakra,
    CloseButton,
    Dialog,
    Flex,
    Portal
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { Drawer } from "vaul";
import { useIsPhone } from "../../hooks/useIsPhone";

const SheetOverlay = chakra(Drawer.Overlay);
const SheetContent = chakra(Drawer.Content);
const SheetTitle = chakra(Drawer.Title);
const SheetDescription = chakra(Drawer.Description);

interface PanelSurfaceProps {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Read by screen readers only */
    description: string;
    /** Beside the title, e.g. a reset action */
    headerAction?: ReactNode;
    children: ReactNode;
}

/**
 * Surface for panels whose changes apply as they are made, such as filters.
 * A bottom sheet on phones, dismissed by dragging down, and a centred dialog
 * on desktop. Either closes with "Done".
 */
export default function PanelSurface(props: PanelSurfaceProps) {
    const isPhone = useIsPhone();
    return isPhone ? <PanelSheet {...props} /> : <PanelDialog {...props} />;
}

function PanelSheet({
    open,
    onClose,
    title,
    description,
    headerAction,
    children
}: PanelSurfaceProps) {
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
                    data-surface="sheet"
                    position="fixed"
                    insetX="0"
                    bottom="0"
                    zIndex="modal"
                    maxH="85dvh"
                    display="flex"
                    flexDirection="column"
                    bg="bg.panel"
                    roundedTop="2xl"
                    outline="none"
                    pt="2"
                    pb="calc(1rem + env(safe-area-inset-bottom))">
                    <Box
                        aria-hidden
                        mx="auto"
                        mb="2"
                        w="10"
                        h="1"
                        flexShrink="0"
                        rounded="full"
                        bg="border.emphasized"
                    />
                    <Flex
                        alignItems="center"
                        gap="2"
                        px="calc(1rem + env(safe-area-inset-left))"
                        pb="2">
                        <SheetTitle
                            flex="1"
                            textStyle="lg"
                            fontWeight="semibold">
                            {title}
                        </SheetTitle>
                        {headerAction}
                    </Flex>
                    <SheetDescription srOnly>{description}</SheetDescription>
                    {/* vaul lets this scroll without dragging the sheet */}
                    <Box
                        flex="1"
                        overflowY="auto"
                        px="calc(1rem + env(safe-area-inset-left))"
                        py="2">
                        {children}
                    </Box>
                    <Box px="calc(1rem + env(safe-area-inset-left))" pt="3">
                        <Button size="lg" w="full" onClick={onClose}>
                            Done
                        </Button>
                    </Box>
                </SheetContent>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

function PanelDialog({
    open,
    onClose,
    title,
    description,
    headerAction,
    children
}: PanelSurfaceProps) {
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(details) => !details.open && onClose()}
            placement="center"
            size="md"
            scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content data-surface="dialog">
                        <Dialog.Header display="flex" alignItems="center" gap="2">
                            <Dialog.Title flex="1">{title}</Dialog.Title>
                            {headerAction}
                            <Dialog.CloseTrigger asChild position="static">
                                <CloseButton size="sm" />
                            </Dialog.CloseTrigger>
                        </Dialog.Header>
                        <Dialog.Description srOnly>{description}</Dialog.Description>
                        <Dialog.Body>{children}</Dialog.Body>
                        <Dialog.Footer>
                            <Button onClick={onClose}>Done</Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
