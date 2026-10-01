import { goBack } from "@/lib/client/navigation";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { mdiArrowLeft } from "@mdi/js";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import TitleBarButton from "./TitleBarButton";

/** Height of the title bar, not counting the safe-area inset above it */
export const TITLE_BAR_HEIGHT = "52px";
const FULL_HEIGHT = `calc(${TITLE_BAR_HEIGHT} + env(safe-area-inset-top))`;

interface CollectionTitleBarProps {
    /** Absent while the collection loads, or when it fails to */
    name: string | undefined;
    /** Buttons at the end of the bar, e.g. an overflow menu */
    actions?: ReactNode;
}

/**
 * The collection page's header, fixed to the top below the notch: Back, the
 * collection's name and its actions. What follows it on the page starts below it.
 */
export default function CollectionTitleBar({
    name,
    actions
}: CollectionTitleBarProps) {
    const router = useRouter();
    return (
        <>
            <Flex
                position="fixed"
                top="0"
                left="0"
                right="0"
                zIndex="sticky"
                alignItems="center"
                gap="1"
                h={FULL_HEIGHT}
                pt="env(safe-area-inset-top)"
                pl="calc(0.25rem + env(safe-area-inset-left))"
                pr="calc(0.25rem + env(safe-area-inset-right))"
                bg="bg.panel"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                color="fg">
                <TitleBarButton
                    aria-label="Back"
                    icon={mdiArrowLeft}
                    onClick={() => goBack(router, "/")}
                />
                {name ? (
                    <Heading
                        as="h1"
                        flex="1"
                        minW="0"
                        textStyle="md"
                        fontWeight="semibold"
                        truncate>
                        {name}
                    </Heading>
                ) : (
                    <Box flex="1" />
                )}
                {actions}
            </Flex>
            {/* Keeps the page clear of the fixed bar */}
            <Box h={FULL_HEIGHT} />
        </>
    );
}
