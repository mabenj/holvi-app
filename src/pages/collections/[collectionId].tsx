import { collectionUrl, fetchCollection } from "@/lib/client/collections";
import { signedInPageProps } from "@/lib/common/signed-in-page";
import AppShell from "@/lib/components/app-shell/AppShell";
import CollectionDetails from "@/lib/components/collection-page/CollectionDetails";
import CollectionHero from "@/lib/components/collection-page/CollectionHero";
import FileGrid from "@/lib/components/collection-page/FileGrid";
import FileSortSelect from "@/lib/components/collection-page/FileSortSelect";
import FileLightbox from "@/lib/components/lightbox/FileLightbox";
import { useCollectionFiles } from "@/lib/hooks/useCollectionFiles";
import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { FileSort } from "@/lib/types/file-sort";
import { Box, Button, EmptyState, Flex, Text, VStack } from "@chakra-ui/react";
import { mdiImagePlusOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useSWR from "swr";

export const getServerSideProps = signedInPageProps;

/** Skeleton tiles while the first page of files loads */
const FIRST_PAGE_SKELETONS = 12;
/** Skeleton tiles after the grid while the next page loads */
const NEXT_PAGE_SKELETONS = 6;

export default function CollectionPage() {
    const { query } = useRouter();
    const collectionId = query.collectionId as string;
    // Another collection starts afresh, with the default sort
    return <CollectionScreen key={collectionId} collectionId={collectionId} />;
}

function CollectionScreen({ collectionId }: { collectionId: string }) {
    const { data: collection, error: collectionError } = useSWR(
        collectionUrl(collectionId),
        () => fetchCollection(collectionId),
        { revalidateOnFocus: false }
    );

    const [sort, setSort] = useState<FileSort>("newest");
    const { files, pages, loading, error, hasMore, loadMore, retry } =
        useCollectionFiles(collectionId, sort);

    // Opening the collection or choosing another sort fetches the first page
    useEffect(() => {
        if (pages.length === 0) loadMore();
    }, [pages.length, loadMore]);

    const lightbox = useLightboxHistory();

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
        <AppShell title={collection?.name ?? "Collection"} bleedTop>
            <CollectionHero collection={collection ?? null} />
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
                    <Flex justifyContent="flex-end" px="4" py="2">
                        <FileSortSelect value={sort} onChange={setSort} />
                    </Flex>
                    {isEmpty ? (
                        <NoFilesYet />
                    ) : (
                        <FileGrid
                            files={files}
                            skeletons={skeletons}
                            onOpen={lightbox.open}
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
                    />
                </>
            )}
        </AppShell>
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
