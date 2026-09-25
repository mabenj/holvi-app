import { Box, Flex, Heading, IconButton } from "@chakra-ui/react";
import Icon from "@mdi/react";
import Head from "next/head";
import { ReactNode } from "react";
import { TAB_BAR_HEIGHT } from "../theme/system";
import TabBar from "./TabBar";

/** The context-aware floating action button; each screen decides its action */
export interface FloatingAction {
    label: string;
    icon: string;
    onClick: () => void;
}

interface AppShellProps {
    title: string;
    children: ReactNode;
    /** Hidden when absent, e.g. on the Timeline */
    floatingAction?: FloatingAction;
    /** What tapping the tab of this screen does, e.g. refresh and scroll to the top */
    onActiveTabReselect?: () => void;
    /**
     * The content starts at the very top, under the notch, and shows its own
     * heading instead of the page header, e.g. a collection page's hero
     */
    bleedTop?: boolean;
    /** Replaces the tab bar and the floating action button while present, e.g. the selection bar */
    contextualBar?: ReactNode;
    /** Beside the page header, e.g. a filter button */
    headerAction?: ReactNode;
}

/** Frame of every signed-in screen: page header, content and the bottom tab bar */
export default function AppShell({
    title,
    children,
    floatingAction,
    onActiveTabReselect,
    bleedTop = false,
    contextualBar,
    headerAction
}: AppShellProps) {
    return (
        <>
            <Head>
                <title>{`${title} · Holvi`}</title>
            </Head>
            <Flex
                as="main"
                direction="column"
                minH="100dvh"
                pt={bleedTop ? undefined : "env(safe-area-inset-top)"}
                pl="env(safe-area-inset-left)"
                pr="env(safe-area-inset-right)"
                // Keep the end of the content clear of the fixed tab bar
                pb={`calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`}>
                {!bleedTop && (
                    <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        gap="2"
                        px="4"
                        pt="4"
                        pb="2">
                        <Heading as="h1" textStyle="2xl">
                            {title}
                        </Heading>
                        {headerAction}
                    </Flex>
                )}
                <Box flex="1">{children}</Box>
            </Flex>
            {contextualBar ?? (
                <>
                    {floatingAction && (
                        <FloatingActionButton {...floatingAction} />
                    )}
                    <TabBar onActiveTabReselect={onActiveTabReselect} />
                </>
            )}
        </>
    );
}

function FloatingActionButton({ label, icon, onClick }: FloatingAction) {
    return (
        <IconButton
            aria-label={label}
            onClick={onClick}
            position="fixed"
            zIndex="sticky"
            right="calc(1rem + env(safe-area-inset-right))"
            bottom={`calc(${TAB_BAR_HEIGHT} + 1rem + env(safe-area-inset-bottom))`}
            size="xl"
            rounded="full"
            shadow="lg">
            <Icon path={icon} size="28px" aria-hidden />
        </IconButton>
    );
}
