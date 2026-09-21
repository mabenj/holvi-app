import {
    Button,
    CloseButton,
    Dialog,
    Flex,
    Portal
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { useIsPhone } from "../../hooks/useIsPhone";

interface EditorSurfaceProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    /** Label of the primary action, e.g. "Save" */
    submitLabel: string;
    /** Id of the form in `children` that the primary action submits */
    formId: string;
    submitting?: boolean;
}

/**
 * Surface for editors (collection, file). A full-screen sheet on phones, with
 * its actions at the top so the on-screen keyboard never covers them, and a
 * centred dialog on desktop.
 */
export default function EditorSurface({
    open,
    onClose,
    title,
    children,
    submitLabel,
    formId,
    submitting
}: EditorSurfaceProps) {
    const isPhone = useIsPhone();

    const submitButton = (
        <Button
            type="submit"
            form={formId}
            loading={submitting}
            size={isPhone ? "sm" : "md"}>
            {submitLabel}
        </Button>
    );

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(details) => !details.open && onClose()}
            size={isPhone ? "full" : "md"}
            placement="center"
            motionPreset={isPhone ? "slide-in-bottom" : "scale"}
            scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        data-surface={isPhone ? "sheet" : "dialog"}
                        {...(isPhone && {
                            maxH: "100dvh",
                            pt: "env(safe-area-inset-top)",
                            pb: "env(safe-area-inset-bottom)",
                            pl: "env(safe-area-inset-left)",
                            pr: "env(safe-area-inset-right)"
                        })}>
                        {isPhone ? (
                            <Dialog.Header
                                display="flex"
                                alignItems="center"
                                gap="2"
                                px="2"
                                py="2"
                                borderBottomWidth="1px">
                                <Dialog.CloseTrigger
                                    asChild
                                    position="static">
                                    <CloseButton size="sm" />
                                </Dialog.CloseTrigger>
                                <Dialog.Title flex="1" textStyle="md" truncate>
                                    {title}
                                </Dialog.Title>
                                {submitButton}
                            </Dialog.Header>
                        ) : (
                            <Dialog.Header>
                                <Dialog.Title>{title}</Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <CloseButton size="sm" />
                                </Dialog.CloseTrigger>
                            </Dialog.Header>
                        )}
                        <Dialog.Body pt={isPhone ? "4" : undefined}>
                            {children}
                        </Dialog.Body>
                        {!isPhone && (
                            <Dialog.Footer>
                                <Flex gap="3">
                                    <Button variant="ghost" onClick={onClose}>
                                        Cancel
                                    </Button>
                                    {submitButton}
                                </Flex>
                            </Dialog.Footer>
                        )}
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
