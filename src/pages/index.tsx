import {
    SignedInPageProps,
    signedInPageProps
} from "@/lib/common/signed-in-page";
import AppShell from "@/lib/components/app-shell/AppShell";
import PullToRefresh from "@/lib/components/app-shell/PullToRefresh";
import CollectionGrid from "@/lib/components/collections/CollectionGrid";
import { useCollectionsBrowse } from "@/lib/hooks/useCollectionsBrowse";
import { Box, Button, EmptyState, Text, VStack } from "@chakra-ui/react";
import { mdiImageMultipleOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useCallback, useEffect, useRef } from "react";

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
        retry,
        refresh
    } = useCollectionsBrowse(user.id);
    const collections = pages.flatMap((page) => page.collections);

    // The first visit in this app session fetches the first page; coming back
    // from another screen keeps the pages already loaded
    useEffect(() => {
        loadMore();
    }, [loadMore]);

    const startOver = useCallback(() => {
        window.scrollTo({ top: 0 });
        refresh();
    }, [refresh]);

    const sentinel = useNextPageSentinel(
        hasMore && !error ? loadMore : undefined,
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

/**
 * A ref for an element at the end of the grid. It calls `onNear` once the element
 * comes within one screen of the viewport. `pageCount` re-arms it after every
 * page, in case the element is still that close.
 */
function useNextPageSentinel(
    onNear: (() => void) | undefined,
    pageCount: number
) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element || !onNear) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onNear();
            },
            { rootMargin: "0px 0px 100% 0px" }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [onNear, pageCount]);
    return ref;
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
