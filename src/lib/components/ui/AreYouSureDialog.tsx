import { Box, Button, Flex, Heading, useDisclosure } from "@chakra-ui/react";
import Dialog from "./Dialog";

interface AreYouSureDialogProps {
    trigger: React.ReactNode;
    header: React.ReactNode;
    children: React.ReactNode;
    isConfirming: boolean;
    onConfirm: () => Promise<void>;
    confirmLabel: string;
}

export default function AreYouSureDialog({
    trigger,
    header,
    children,
    isConfirming,
    onConfirm,
    confirmLabel
}: AreYouSureDialogProps) {
    const { isOpen, onClose, onOpen } = useDisclosure();

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            onOpen={onOpen}
            title={
                <Heading size="lg" mb={10} mx="auto" textAlign="center">
                    {header}
                </Heading>
            }
            trigger={trigger}>
            <Box textAlign="center">{children}</Box>
            <Flex
                w="100%"
                alignItems="center"
                justifyContent="center"
                gap={3}
                mt={10}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    colorScheme="red"
                    onClick={() => onConfirm().then(() => onClose())}
                    isLoading={isConfirming}
                    ml={3}>
                    {confirmLabel}
                </Button>
            </Flex>
        </Dialog>
    );
}
