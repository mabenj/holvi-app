import { fetchCollection } from "@/lib/client/collections";
import {
    SignedInPageProps,
    signedInPageProps
} from "@/lib/common/signed-in-page";
import {
    CollectionsFilter,
    isFiltering,
    NO_COLLECTIONS_FILTER
} from "@/lib/client/collections";
import AppShell from "@/lib/components/app-shell/AppShell";
import DropOverlay from "@/lib/components/app-shell/DropOverlay";
import PullToRefresh from "@/lib/components/app-shell/PullToRefresh";
import CollectionEditor from "@/lib/components/collections/CollectionEditor";
import CollectionGrid from "@/lib/components/collections/CollectionGrid";
import CollectionSelectionBar from "@/lib/components/collections/CollectionSelectionBar";
import CollectionsFilterBar from "@/lib/components/collections/CollectionsFilterBar";
import {
    featureCollection,
    useCollectionsBrowse
} from "@/lib/hooks/useCollectionsBrowse";
import { DroppedFiles, useFileDrop } from "@/lib/hooks/useFileDrop";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { useSelection } from "@/lib/hooks/useSelection";
import { startUpload } from "@/lib/hooks/useUpload";
import { Box, Button, EmptyState, Text, VStack } from "@chakra-ui/react";
import {
    mdiImageMultipleOutline,
    mdiMagnifyRemoveOutline,
    mdiPlus
} from "@mdi/js";
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
        filter,
        pages,
        collections,
        loading,
        refreshing,
        error,
        hasMore,
        loadMore,
        loadFirstPage,
        changeFilter,
        saveScrollPosition,
        takeScrollPosition,
        endVisit,
        retry,
        refresh
    } = useCollectionsBrowse(user.id);
    const router = useRouter();
    const creator = useCollectionCreator(user.id);
    const selection = useSelection();
    const [selectionError, setSelectionError] = useState<string | null>(null);
    useEffect(() => {
        if (!selection.selecting) setSelectionError(null);
    }, [selection.selecting]);

    // The first visit in this app session fetches the first page; coming back
    // from another screen keeps the pages already loaded
    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    // Leaving the tab remembers the place in the grid, and ends the visit that
    // showed a collection just uploaded into first...
    useEffect(() => {
        const leave = (_url: string, { shallow }: { shallow: boolean }) => {
            // Shallow changes stay on the tab, e.g. entering selection mode
            if (shallow) return;
            saveScrollPosition(window.scrollY);
            endVisit();
        };
        router.events.on("routeChangeStart", leave);
        return () => router.events.off("routeChangeStart", leave);
    }, [router.events, saveScrollPosition, endVisit]);

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

    // Another filter shows its own collections from the top. A selection
    // would keep collections it no longer shows, so it ends.
    const exitSelection = selection.exit;
    const narrow = useCallback(
        (changes: Partial<CollectionsFilter>) => {
            window.scrollTo({ top: 0 });
            exitSelection();
            changeFilter(changes);
        },
        [changeFilter, exitSelection]
    );
    const clearFilter = useCallback(
        () => narrow(NO_COLLECTIONS_FILTER),
        [narrow]
    );

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
        <AppShell
            title="Collections"
            onActiveTabReselect={startOver}
            floatingAction={{
                label: "New collection",
                icon: mdiPlus,
                onClick: () => creator.open()
            }}
            contextualBar={
                selection.selecting ? (
                    <CollectionSelectionBar
                        userId={user.id}
                        selection={selection}
                        selected={collections.filter((collection) =>
                            selection.isSelected(collection.id)
                        )}
                        onError={setSelectionError}
                    />
                ) : undefined
            }>
            <CollectionsFilterBar filter={filter} onChange={narrow} />
            {selectionError && (
                <Text px="4" py="2" color="fg.error" textStyle="sm" role="alert">
                    {selectionError}
                </Text>
            )}
            <PullToRefresh onRefresh={startOver} refreshing={refreshing}>
                {isEmpty && isFiltering(filter) ? (
                    <NoMatches onClear={clearFilter} />
                ) : isEmpty ? (
                    <FirstCollectionPrompt onCreate={() => creator.open()} />
                ) : (
                    <CollectionGrid
                        collections={collections}
                        skeletons={skeletons}
                        onLaidOut={restoreScrollPosition}
                        selection={selection}
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
            <CollectionEditor
                open={creator.isOpen}
                onClose={creator.close}
                initialName={creator.dropped?.folderName ?? ""}
                fileCount={creator.dropped?.files.length}
                onSaved={creator.onCreated}
            />
            <DropOverlay
                visible={creator.dragging}
                label="Drop to create a collection"
            />
        </AppShell>
    );
}

/**
 * Creating a collection from the tab, from the floating button or from files
 * dropped on it. Once created, the app goes into the new collection, where
 * dropped files upload, and the tab shows it first on the next visit.
 */
function useCollectionCreator(userId: string) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [dropped, setDropped] = useState<DroppedFiles | null>(null);

    const open = useCallback((files: DroppedFiles | null = null) => {
        setDropped(files);
        setIsOpen(true);
    }, []);
    const close = useCallback(() => setIsOpen(false), []);

    const { dragging } = useFileDrop(open, !isOpen);

    const onCreated = async (collectionId: string) => {
        if (dropped) void startUpload(userId, collectionId, dropped.files);
        // Entering the collection leaves the tab, which ends its visit; the
        // new collection is shown first on the next one
        await router.push(`/collections/${encodeURIComponent(collectionId)}`);
        setIsOpen(false);
        fetchCollection(collectionId)
            .then((collection) => featureCollection(userId, collection))
            .catch(() => undefined);
    };

    return { isOpen, dropped, dragging, open, close, onCreated };
}

function FirstCollectionPrompt({ onCreate }: { onCreate: () => void }) {
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
                <Button onClick={onCreate}>
                    <Icon path={mdiPlus} size="20px" aria-hidden />
                    New collection
                </Button>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}

/** No collection matches the filters, as opposed to there being no collections at all */
function NoMatches({ onClear }: { onClear: () => void }) {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon
                        path={mdiMagnifyRemoveOutline}
                        size="48px"
                        aria-hidden
                    />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>No matches</EmptyState.Title>
                    <EmptyState.Description>
                        No collection matches your search and filters.
                    </EmptyState.Description>
                </VStack>
                <Button variant="outline" size="sm" onClick={onClear}>
                    Clear filters
                </Button>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}
