import { signedInPageProps } from "@/lib/common/signed-in-page";
import AppShell from "@/lib/components/app-shell/AppShell";
import FileGrid from "@/lib/components/collection-page/FileGrid";
import TimelineGrid from "@/lib/components/timeline/TimelineGrid";
import { useNextPageSentinel } from "@/lib/hooks/useNextPageSentinel";
import { useTimelineFiles } from "@/lib/hooks/useTimelineFiles";
import { Box, Button, EmptyState, Text, VStack } from "@chakra-ui/react";
import { mdiTimelineClockOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect } from "react";

export const getServerSideProps = signedInPageProps;

/** Skeleton tiles while the first page of the Timeline loads */
const FIRST_PAGE_SKELETONS = 12;

/** Every file the user owns, newest first, under sticky month headers; no floating action button */
export default function TimelineTab() {
    const { files, pages, loading, error, hasMore, loadMore, retry } =
        useTimelineFiles();

    // Opening the Timeline, or trying again after an error, fetches the first page
    useEffect(() => {
        if (pages.length === 0) loadMore();
    }, [pages.length, loadMore]);

    const sentinel = useNextPageSentinel(
        pages.length > 0 && hasMore && !error ? loadMore : undefined,
        pages.length
    );

    const isEmpty = pages.length > 0 && files.length === 0;

    return (
        <AppShell title="Timeline">
            {pages.length === 0 && !error ? (
                <FileGrid files={[]} skeletons={FIRST_PAGE_SKELETONS} />
            ) : isEmpty ? (
                <NoFilesYet />
            ) : (
                <TimelineGrid files={files} loadingMore={loading} />
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
