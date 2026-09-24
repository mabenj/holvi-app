import { Box, chakra, Flex, Text, VisuallyHidden } from "@chakra-ui/react";
import {
    mdiCog,
    mdiCogOutline,
    mdiImageMultiple,
    mdiImageMultipleOutline,
    mdiTimelineClock,
    mdiTimelineClockOutline
} from "@mdi/js";
import Icon from "@mdi/react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useActivity } from "../../hooks/useActivity";
import { TAB_BAR_HEIGHT } from "../theme/system";

const TabLink = chakra(NextLink);

interface Tab {
    label: string;
    href: string;
    icon: string;
    activeIcon: string;
    isActive: (pathname: string) => boolean;
    /** Shows the badge while the user has background work running */
    badgesActivity?: boolean;
}

const TABS: Tab[] = [
    {
        label: "Collections",
        href: "/",
        icon: mdiImageMultipleOutline,
        activeIcon: mdiImageMultiple,
        // A collection page belongs to the Collections tab
        isActive: (pathname) =>
            pathname === "/" || pathname.startsWith("/collections")
    },
    {
        label: "Timeline",
        href: "/timeline",
        icon: mdiTimelineClockOutline,
        activeIcon: mdiTimelineClock,
        isActive: (pathname) => pathname.startsWith("/timeline")
    },
    {
        label: "Settings",
        href: "/settings",
        icon: mdiCogOutline,
        activeIcon: mdiCog,
        badgesActivity: true,
        isActive: (pathname) => pathname.startsWith("/settings")
    }
];

interface TabBarProps {
    /** Called instead of navigating when the user taps the tab of the screen they are on */
    onActiveTabReselect?: () => void;
}

export default function TabBar({ onActiveTabReselect }: TabBarProps) {
    const { pathname } = useRouter();
    const { activity } = useActivity();
    const working = activity?.active ?? false;

    return (
        <Box
            as="nav"
            aria-label="Main"
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
            <Flex h={TAB_BAR_HEIGHT} maxW="lg" mx="auto">
                {TABS.map((tab) => {
                    const active = tab.isActive(pathname);
                    // Only the tab's own screen: from a collection page, Collections goes back
                    const reselected = pathname === tab.href;
                    const badged = working && tab.badgesActivity;
                    return (
                        <TabLink
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            onClick={(event) => {
                                if (reselected && onActiveTabReselect) {
                                    event.preventDefault();
                                    onActiveTabReselect();
                                }
                            }}
                            flex="1"
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                            justifyContent="center"
                            gap="0.5"
                            color={active ? "fg" : "fg.muted"}
                            _focusVisible={{
                                outline: "2px solid",
                                outlineColor: "colorPalette.focusRing",
                                outlineOffset: "-2px"
                            }}>
                            <Box position="relative">
                                <Icon
                                    path={active ? tab.activeIcon : tab.icon}
                                    size="24px"
                                    aria-hidden
                                />
                                {badged && (
                                    <Box
                                        data-testid="activity-badge"
                                        position="absolute"
                                        top="-1px"
                                        right="-3px"
                                        boxSize="10px"
                                        rounded="full"
                                        bg="colorPalette.solid"
                                        colorPalette="blue"
                                        borderWidth="2px"
                                        borderColor="bg.panel"
                                    />
                                )}
                            </Box>
                            <Text
                                textStyle="2xs"
                                fontWeight={active ? "semibold" : "medium"}>
                                {tab.label}
                            </Text>
                            {badged && (
                                <VisuallyHidden>
                                    , background work running
                                </VisuallyHidden>
                            )}
                        </TabLink>
                    );
                })}
            </Flex>
        </Box>
    );
}
