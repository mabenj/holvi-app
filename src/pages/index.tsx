import {
    SignedInPageProps,
    signedInPageProps
} from "@/lib/common/signed-in-page";
import AppShell from "@/lib/components/app-shell/AppShell";
import PullToRefresh from "@/lib/components/app-shell/PullToRefresh";
import CollectionGrid from "@/lib/components/collections/CollectionGrid";
import { useCollectionsBrowse } from "@/lib/hooks/useCollectionsBrowse";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { Box, Button, EmptyState, Text, VStack } from "@chakra-ui/react";
import { mdiImageMultipleOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

export const getServerSideProps = signedInPageProps;

/** Skeleton tiles while the first page loads */
const FIRST_PAGE_SKELETONS = 24;
/** Skeleton tiles after the grid while the next page loads */
const NEXT_PAGE_SKELETONS = 12;

export default function CollectionsTab({ user }: SignedInPageProps) {
    const {
        pages,
        loading,
        refreshing,
        error,
        hasMore,
        loadMore,
        loadFirstPage,
        saveScrollPosition,
        takeScrollPosition,
        retry,
        refresh
    } = useCollectionsBrowse(user.id);
    const collections = pages.flatMap((page) => page.collections);
    const router = useRouter();

    // The first visit in this app session fetches the first page; coming back
    // from another screen keeps the pages already loaded
    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    // Leaving the tab remembers the place in the grid...
    useEffect(() => {
        const save = () => saveScrollPosition(window.scrollY);
        router.events.on("routeChangeStart", save);
        return () => router.events.off("routeChangeStart", save);
    }, [router.events, saveScrollPosition]);

    // ...and coming back scrolls there once every cached page is in the grid.
    // Until then, the next page must not load: the grid's end is still in view.
    const [restored, setRestored] = useState(false);
    const restoreScrollPosition = useCallback(() => {
        const position = takeScrollPosition();
        if (position !== null) window.scrollTo({ top: position });
        setRestored(true);
    }, [takeScrollPosition]);

    const startOver = useCallback(() => {
        window.scrollTo({ top: 0 });
        refresh();
    }, [refresh]);

    const sentinel = useNextPageSentinel(
        restored && hasMore && !error ? loadMore : undefined,
        pages.length
    );

    const isEmpty = pages.length > 0 && collections.length === 0;
    const skeletons =
        pages.length === 0 && !error
            ? FIRST_PAGE_SKELETONS
            : loading && !refreshing
              ? NEXT_PAGE_SKELETONS
              : 0;

    return (
        <AppShell title="Collections" onActiveTabReselect={startOver}>
            <PullToRefresh onRefresh={startOver} refreshing={refreshing}>
                {isEmpty ? (
                    <FirstCollectionPrompt />
                ) : (
                    <CollectionGrid
                        collections={collections}
                        skeletons={skeletons}
                        onLaidOut={restoreScrollPosition}
                    />
                )}
                {error && (
                    <VStack py="8" px="4" gap="3" textAlign="center">
                        <Text color="fg.muted">{error}</Text>
                        <Button variant="outline" size="sm" onClick={retry}>
                            Try again
                        </Button>
                    </VStack>
                )}
                <Box ref={sentinel} h="1px" />
            </PullToRefresh>
        </AppShell>
    );
}

function FirstCollectionPrompt() {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon
                        path={mdiImageMultipleOutline}
                        size="48px"
                        aria-hidden
                    />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>Create your first collection</EmptyState.Title>
                    <EmptyState.Description>
                        Collections hold your photos and videos. Once you
                        create one, it shows up here.
                    </EmptyState.Description>
                </VStack>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}
