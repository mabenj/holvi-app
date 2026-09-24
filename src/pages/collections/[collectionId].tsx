import {
    collectionUrl,
    deleteCollection,
    fetchCollection,
    recordOpen
} from "@/lib/client/collections";
import { leaveFor } from "@/lib/client/navigation";
import {
    SignedInPageProps,
    signedInPageProps
} from "@/lib/common/signed-in-page";
import { getErrorMessage } from "@/lib/common/utilities";
import AppShell from "@/lib/components/app-shell/AppShell";
import DropOverlay from "@/lib/components/app-shell/DropOverlay";
import CollectionDetails from "@/lib/components/collection-page/CollectionDetails";
import CollectionHero from "@/lib/components/collection-page/CollectionHero";
import CollectionMenu from "@/lib/components/collection-page/CollectionMenu";
import FileGrid from "@/lib/components/collection-page/FileGrid";
import FileSortSelect from "@/lib/components/collection-page/FileSortSelect";
import FileTagFilter from "@/lib/components/collection-page/FileTagFilter";
import UploadStatus from "@/lib/components/collection-page/UploadStatus";
import CollectionEditor from "@/lib/components/collections/CollectionEditor";
import FileSelectionBar from "@/lib/components/files/FileSelectionBar";
import { showSelectionChanges } from "@/lib/components/files/selection-changes";
import FileLightbox from "@/lib/components/lightbox/FileLightbox";
import SetAsCover from "@/lib/components/lightbox/SetAsCover";
import ConfirmationSurface from "@/lib/components/surfaces/ConfirmationSurface";
import { useCollectionFiles } from "@/lib/hooks/useCollectionFiles";
import { useCollectionFilesQuery } from "@/lib/hooks/useBrowseQuery";
import {
    removeCollection,
    replaceCollection
} from "@/lib/hooks/useCollectionsBrowse";
import { useFileDrop } from "@/lib/hooks/useFileDrop";
import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { useSelection } from "@/lib/hooks/useSelection";
import {
    forgetTimeline,
    removeFromTimeline
} from "@/lib/hooks/useTimelineFiles";
import { isUploading, startUpload, useUpload } from "@/lib/hooks/useUpload";
import { CollectionDetails as Collection } from "@/lib/types/collection-details";
import { FileSort } from "@/lib/types/file-sort";
import { Box, Button, EmptyState, Flex, Text, VStack } from "@chakra-ui/react";
import { mdiImagePlusOutline, mdiTagOffOutline, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import { useRouter } from "next/router";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import useSWR, { KeyedMutator } from "swr";

export const getServerSideProps = signedInPageProps;

/** Skeleton tiles while the first page of files loads */
const FIRST_PAGE_SKELETONS = 12;
/** Skeleton tiles after the grid while the next page loads */
const NEXT_PAGE_SKELETONS = 6;

export default function CollectionPage({ user }: SignedInPageProps) {
    const { query } = useRouter();
    const collectionId = query.collectionId as string;
    // Another collection starts afresh, with the sort and tags in its URL
    return (
        <CollectionScreen
            key={collectionId}
            collectionId={collectionId}
            userId={user.id}
        />
    );
}

/**
 * Opening the page is a visit to the collection, which the server counts as
 * an Open unless it extends the previous one. Sent once as the page mounts:
 * not when its data revalidates, nor as the lightbox shows files.
 */
function useRecordOpen(collectionId: string) {
    // Development's strict mode mounts twice; one visit is one request
    const recorded = useRef(false);
    useEffect(() => {
        if (recorded.current) return;
        recorded.current = true;
        // A visit that fails to count is not worth troubling the user with
        recordOpen(collectionId).catch(() => undefined);
    }, [collectionId]);
}

function CollectionScreen({
    collectionId,
    userId
}: {
    collectionId: string;
    userId: string;
}) {
    const {
        data: collection,
        error: collectionError,
        mutate: refetchCollection
    } = useSWR(
        collectionUrl(collectionId),
        () => fetchCollection(collectionId),
        { revalidateOnFocus: false }
    );

    useRecordOpen(collectionId);

    // From the URL; without a sort there, the remembered file sort applies
    const { sortKnown, sort, tags, chooseSort, changeTags } =
        useCollectionFilesQuery();
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
    } = useCollectionFiles(collectionId, sort, tags);
    const selection = useSelection();
    // Another sort or tags loads the files afresh, so a selection ends
    const setSort = (sort: FileSort) => {
        selection.exit();
        chooseSort(sort);
    };
    const setTags = (tags: string[]) => {
        selection.exit();
        changeTags(tags);
    };
    const selectionChanges = showSelectionChanges(
        { reload, changeFiles },
        tags.length > 0
    );

    // Deleting or renaming files, or choosing the Cover, can change the counts
    // and the Cover, here and on the Collections tab
    const refreshCollection = async () => {
        const updated = await refetchCollection();
        if (updated) replaceCollection(userId, updated);
    };

    const { upload, dismiss } = useUpload(collectionId);
    const uploadFiles = useCallback(
        (files: File[]) => void startUpload(userId, collectionId, files),
        [userId, collectionId]
    );
    const picker = useRef<HTMLInputElement>(null);
    const onPicked = (event: ChangeEvent<HTMLInputElement>) => {
        uploadFiles(Array.from(event.target.files ?? []));
        // Picking the same files again must fire another change
        event.target.value = "";
    };

    const lightbox = useLightboxHistory();

    // When an upload into this collection ends, the new files appear and the
    // hero shows the new counts and Cover. One that finished before the page
    // opened is already in what it loads. While the lightbox is open, the
    // grid waits until it closes: reloading replaces the loaded files, which
    // would shift the slides under it.
    const finishedUpload = upload?.status === "done" ? upload.sequence : null;
    const seenUpload = useRef(finishedUpload);
    const lightboxOpen = !!lightbox.photoId;
    useEffect(() => {
        if (finishedUpload === null || finishedUpload === seenUpload.current) {
            return;
        }
        void refetchCollection();
        if (lightboxOpen) return;
        seenUpload.current = finishedUpload;
        reload();
        // Only a newly finished upload reloads, not a change of sort
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finishedUpload, lightboxOpen]);

    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const { dragging } = useFileDrop(
        ({ files }) => uploadFiles(files),
        !!collection && !editing && !confirmingDelete && !isUploading(upload)
    );

    // Opening the collection or choosing another sort or tags fetches the first
    // page, once the remembered sort is known, so it is not fetched in two sorts
    useEffect(() => {
        if (sortKnown && pages.length === 0) loadMore();
    }, [sortKnown, pages.length, loadMore]);

    const sentinel = useNextPageSentinel(
        pages.length > 0 && hasMore && !error ? loadMore : undefined,
        pages.length
    );

    const isEmpty = pages.length > 0 && files.length === 0;
    const skeletons =
        pages.length === 0 && !error
            ? FIRST_PAGE_SKELETONS
            : loading
              ? NEXT_PAGE_SKELETONS
              : 0;

    return (
        <AppShell
            title={collection?.name ?? "Collection"}
            bleedTop
            floatingAction={
                collection && !isUploading(upload)
                    ? {
                          label: "Upload files",
                          icon: mdiUpload,
                          onClick: () => picker.current?.click()
                      }
                    : undefined
            }
            contextualBar={
                selection.selecting ? (
                    <FileSelectionBar
                        selection={selection}
                        selected={files.filter((file) =>
                            selection.isSelected(file.id)
                        )}
                        collectionId={collectionId}
                        onDeleted={(ids) => {
                            selectionChanges.onDeleted(ids);
                            removeFromTimeline(userId, (file) =>
                                ids.includes(file.id)
                            );
                            void refreshCollection();
                        }}
                        onEdited={(id, fields) => {
                            selectionChanges.onEdited(id, fields);
                            forgetTimeline(userId);
                            void refreshCollection();
                        }}
                        onTagged={(tagsById) => {
                            selectionChanges.onTagged(tagsById);
                            forgetTimeline(userId);
                        }}
                    />
                ) : undefined
            }>
            <CollectionHero
                collection={collection ?? null}
                actions={(collapsed) =>
                    collection && (
                        <CollectionMenu
                            collapsed={collapsed}
                            onEdit={() => setEditing(true)}
                            onDelete={() => setConfirmingDelete(true)}
                        />
                    )
                }
            />
            {collectionError ? (
                <Text px="4" py="6" color="fg.muted" textAlign="center">
                    {collectionError.message}
                </Text>
            ) : (
                <>
                    {collection && (
                        <CollectionDetails
                            description={collection.description}
                            tags={collection.tags}
                        />
                    )}
                    <Flex
                        justifyContent="flex-end"
                        alignItems="center"
                        gap="3"
                        px="4"
                        py="2">
                        <FileTagFilter
                            collectionId={collectionId}
                            value={tags}
                            onChange={setTags}
                        />
                        <FileSortSelect value={sort} onChange={setSort} />
                    </Flex>
                    {isEmpty && tags.length > 0 ? (
                        <NoTaggedFiles onClear={() => setTags([])} />
                    ) : isEmpty ? (
                        <NoFilesYet />
                    ) : (
                        <FileGrid
                            files={files}
                            skeletons={skeletons}
                            onOpen={lightbox.open}
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
                    {/* Swiping on past the loaded files loads the next page */}
                    <FileLightbox
                        files={files}
                        onNearEnd={hasMore && !error ? loadMore : undefined}
                        actions={(file) => (
                            <SetAsCover
                                file={file}
                                isCover={
                                    collection?.cover?.thumbnailSrc ===
                                    file.thumbnailSrc
                                }
                                onSet={refreshCollection}
                            />
                        )}
                    />
                </>
            )}
            <input
                ref={picker}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={onPicked}
            />
            <UploadStatus upload={upload} onDismiss={dismiss} />
            {collection && (
                <>
                    <EditCollection
                        open={editing}
                        onClose={() => setEditing(false)}
                        collection={collection}
                        refetch={refetchCollection}
                        userId={userId}
                    />
                    <DeleteCollection
                        open={confirmingDelete}
                        onClose={() => setConfirmingDelete(false)}
                        collection={collection}
                        userId={userId}
                    />
                </>
            )}
            <DropOverlay
                visible={dragging}
                label={`Drop to upload into ${collection?.name ?? "the collection"}`}
            />
        </AppShell>
    );
}

interface CollectionActionProps {
    open: boolean;
    onClose: () => void;
    collection: Collection;
    userId: string;
}

/** The collection editor; saving shows the changes here and on the Collections tab */
function EditCollection({
    open,
    onClose,
    collection,
    userId,
    refetch
}: CollectionActionProps & { refetch: KeyedMutator<Collection> }) {
    const onSaved = async () => {
        const updated = await refetch();
        if (updated) replaceCollection(userId, updated);
        // Its tags match Timeline files under a tag filter
        forgetTimeline(userId);
        onClose();
    };
    return (
        <CollectionEditor
            open={open}
            onClose={onClose}
            collection={collection}
            onSaved={onSaved}
        />
    );
}

/** Asks before deleting the collection, then returns to the Collections tab without it */
function DeleteCollection({
    open,
    onClose,
    collection,
    userId
}: CollectionActionProps) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileCount = collection.imageCount + collection.videoCount;

    const confirm = async () => {
        setDeleting(true);
        setError(null);
        try {
            await deleteCollection(collection.id);
            removeCollection(userId, collection.id);
            removeFromTimeline(
                userId,
                (file) => file.collectionId === collection.id
            );
            leaveFor(router, "/");
        } catch (error) {
            setError(getErrorMessage(error));
            setDeleting(false);
        }
    };

    return (
        <ConfirmationSurface
            open={open}
            onClose={() => {
                setError(null);
                onClose();
            }}
            title="Delete collection?"
            description={
                error ??
                (fileCount === 0
                    ? `${collection.name} will be deleted.`
                    : `${collection.name} and its ${fileCount === 1 ? "file" : `${fileCount} files`} will be deleted.`)
            }
            confirmLabel="Delete"
            onConfirm={confirm}
            destructive
            confirming={deleting}
        />
    );
}

function NoFilesYet() {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon path={mdiImagePlusOutline} size="48px" aria-hidden />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>No files yet</EmptyState.Title>
                    <EmptyState.Description>
                        Photos and videos you add to this collection show up
                        here.
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
                        No file in this collection has every selected tag.
                    </EmptyState.Description>
                </VStack>
                <Button variant="outline" size="sm" onClick={onClear}>
                    Clear tags
                </Button>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}
