import { collectionUrl, fetchCollection } from "@/lib/client/collections";
import {
    SignedInPageProps,
    signedInPageProps
} from "@/lib/common/signed-in-page";
import AppShell from "@/lib/components/app-shell/AppShell";
import FileGrid from "@/lib/components/collection-page/FileGrid";
import FileSelectionBar from "@/lib/components/files/FileSelectionBar";
import { showSelectionChanges } from "@/lib/components/files/selection-changes";
import FileLightbox from "@/lib/components/lightbox/FileLightbox";
import GoToCollection from "@/lib/components/lightbox/GoToCollection";
import TimelineGrid from "@/lib/components/timeline/TimelineGrid";
import {
    ActiveTagFilters,
    TimelineFilterButton
} from "@/lib/components/timeline/TimelineTagFilter";
import { replaceCollection } from "@/lib/hooks/useCollectionsBrowse";
import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { useSelection } from "@/lib/hooks/useSelection";
import { useTimelineFiles } from "@/lib/hooks/useTimelineFiles";
import { Box, Button, EmptyState, Text, VStack } from "@chakra-ui/react";
import { mdiTagOffOutline, mdiTimelineClockOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useState } from "react";
import { mutate } from "swr";

export const getServerSideProps = signedInPageProps;

/** Skeleton tiles while the first page of the Timeline loads */
const FIRST_PAGE_SKELETONS = 12;

/**
 * Every file the user owns, newest first, under sticky month headers, with no
 * floating action button. It can be filtered by tag, on a file or its
 * collection, and its files selected for bulk actions as on a collection page.
 * Tapping a file opens the lightbox, which swipes through the whole
 * (filtered) Timeline.
 */
export default function TimelineTab({ user }: SignedInPageProps) {
    const [tags, changeTags] = useState<string[]>([]);
    const {
        files,
        pages,
        loading,
        error,
        hasMore,
        loadMore,
        reload,
        changeFiles,
        retry
    } = useTimelineFiles(tags);
    const selection = useSelection();
    const lightbox = useLightboxHistory();
    // Other tags load the files afresh, so a selection ends
    const setTags = (tags: string[]) => {
        selection.exit();
        changeTags(tags);
    };
    const selectionChanges = showSelectionChanges(
        { reload, changeFiles },
        tags.length > 0
    );

    // Deleting or renaming files can change their collections' counts and
    // Covers, on the Collections tab and the collection pages
    const refreshCollections = (collectionIds: string[]) => {
        for (const id of Array.from(new Set(collectionIds))) {
            mutate(collectionUrl(id), fetchCollection(id))
                .then((updated) => {
                    if (updated) replaceCollection(user.id, updated);
                })
                .catch(() => {
                    // The collection shows its new counts when it is next loaded
                });
        }
    };
    const collectionsOf = (fileIds: string[]) =>
        files
            .filter((file) => fileIds.includes(file.id))
            .map((file) => file.collectionId);

    // Opening the Timeline, choosing other tags or trying again after an
    // error fetches the first page
    useEffect(() => {
        if (pages.length === 0) loadMore();
    }, [pages.length, loadMore]);

    const sentinel = useNextPageSentinel(
        pages.length > 0 && hasMore && !error ? loadMore : undefined,
        pages.length
    );

    const isEmpty = pages.length > 0 && files.length === 0;

    return (
        <AppShell
            title="Timeline"
            headerAction={
                <TimelineFilterButton value={tags} onChange={setTags} />
            }
            contextualBar={
                selection.selecting ? (
                    <FileSelectionBar
                        selection={selection}
                        selected={files.filter((file) =>
                            selection.isSelected(file.id)
                        )}
                        onDeleted={(ids) => {
                            refreshCollections(collectionsOf(ids));
                            selectionChanges.onDeleted(ids);
                        }}
                        onEdited={(id, fields) => {
                            refreshCollections(collectionsOf([id]));
                            selectionChanges.onEdited(id, fields);
                        }}
                        onTagged={selectionChanges.onTagged}
                    />
                ) : undefined
            }>
            <ActiveTagFilters value={tags} onChange={setTags} />
            {pages.length === 0 && !error ? (
                <FileGrid files={[]} skeletons={FIRST_PAGE_SKELETONS} />
            ) : isEmpty && tags.length > 0 ? (
                <NoTaggedFiles onClear={() => setTags([])} />
            ) : isEmpty ? (
                <NoFilesYet />
            ) : (
                <TimelineGrid
                    files={files}
                    loadingMore={loading}
                    selection={selection}
                    onOpen={lightbox.open}
                    activeFileId={lightbox.photoId}
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
            {/* Swiping on past the loaded files loads the next page */}
            <FileLightbox
                files={files}
                onNearEnd={hasMore && !error ? loadMore : undefined}
                actions={(file) => (
                    <GoToCollection collectionId={file.collectionId} />
                )}
            />
        </AppShell>
    );
}

function NoFilesYet() {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon
                        path={mdiTimelineClockOutline}
                        size="48px"
                        aria-hidden
                    />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>No files yet</EmptyState.Title>
                    <EmptyState.Description>
                        Photos and videos you add to your collections show up
                        here, newest first.
                    </EmptyState.Description>
                </VStack>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}

function NoTaggedFiles({ onClear }: { onClear: () => void }) {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon path={mdiTagOffOutline} size="48px" aria-hidden />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>No matching files</EmptyState.Title>
                    <EmptyState.Description>
                        No file has every selected tag, on the file or on its
                        collection.
                    </EmptyState.Description>
                </VStack>
                <Button variant="outline" size="sm" onClick={onClear}>
                    Clear tags
                </Button>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}
