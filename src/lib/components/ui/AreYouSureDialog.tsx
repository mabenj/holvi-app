import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Button
} from "@chakra-ui/react";
import { useRef } from "react";

export default function AreYouSureDialog({
    isOpen,
    onClose,
    header,
    children,
    isConfirming,
    onConfirm,
    confirmLabel
}: {
    isOpen: boolean;
    onClose: () => void;
    header: React.ReactNode;
    children: React.ReactNode;
    isConfirming: boolean;
    onConfirm: () => void;
    confirmLabel: string;
}) {
    const cancelDeleteRef = useRef(null);

    return (
        <AlertDialog
            isOpen={isOpen}
            leastDestructiveRef={cancelDeleteRef}
            onClose={onClose}
            isCentered>
            <AlertDialogOverlay>
                <AlertDialogContent>
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">
                        {header}
                    </AlertDialogHeader>

                    <AlertDialogBody>{children}</AlertDialogBody>

                    <AlertDialogFooter>
                        <Button ref={cancelDeleteRef} onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            colorScheme="red"
                            onClick={onConfirm}
                            isLoading={isConfirming}
                            ml={3}>
                            {confirmLabel}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialogOverlay>
        </AlertDialog>
    );
}
