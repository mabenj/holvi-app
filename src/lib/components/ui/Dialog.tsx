import { Box, useColorModeValue } from "@chakra-ui/react";
import React from "react";
import { Drawer } from "vaul";

interface DialogProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    title: React.ReactNode;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

export default function Dialog({
    trigger,
    children,
    title,
    isOpen,
    onOpen,
    onClose
}: DialogProps) {
    const contentBg = useColorModeValue(
        "linear-gradient(-5deg, #f1f9ff 30%, #ffffff 100%)",
        "linear-gradient(-30deg, #1A202C 50%, #2c3444 100%)"
    );

    const overlayStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)"
    };

    const contentStyle: React.CSSProperties = {
        background: contentBg,
        display: "flex",
        flexDirection: "column",
        borderRadius: "10px",
        marginTop: "12rem",
        paddingBottom: "5rem",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0
    };

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={(isOpen) => (isOpen ? onOpen() : onClose())}>
            <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay style={overlayStyle} />
                <Drawer.Content style={contentStyle}>
                    <Box p={4} flexGrow={1}>
                        <Box
                            w={12}
                            h={1.5}
                            flexShrink={0}
                            rounded="full"
                            mb={8}
                            bg="gray.400"
                            mx="auto"
                        />
                        <Box maxW="2xl" mx="auto">
                            <Drawer.Title>
                                <Box mb={4}>{title}</Box>
                            </Drawer.Title>
                            {children}
                        </Box>
                    </Box>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
