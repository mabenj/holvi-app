import { withSessionSsr } from "@/lib/common/iron-session";
import { isUuidv4 } from "@/lib/common/utilities";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import CollectionModal from "@/lib/components/modals/CollectionModal";
import AreYouSureDialog from "@/lib/components/ui/AreYouSureDialog";
import Layout from "@/lib/components/ui/Layout";
import TagChip from "@/lib/components/ui/TagChip";
import { useCollection } from "@/lib/hooks/useCollection";
import { UserDto } from "@/lib/types/user-dto";
import { Link } from "@chakra-ui/next-js";
import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Button,
    Flex,
    Heading,
    Skeleton,
    SkeletonText
} from "@chakra-ui/react";
import { mdiDelete, mdiSquareEditOutline } from "@mdi/js";
import Icon from "@mdi/react";
import Head from "next/head";
import Linkify from "react-linkify";

export const getServerSideProps = withSessionSsr(
    async function getServerSideProps({ req, query }) {
        const { collectionId } = query as { collectionId: string };
        if (!isUuidv4(collectionId)) {
            return {
                notFound: true
            };
        }
        return {
            props: {
                user: req.session.user,
                collectionId: collectionId
            }
        };
    }
);

export default function CollectionPage({
    user,
    collectionId
}: {
    user: UserDto;
    collectionId: string;
}) {
    let {
        collection,
        isLoading,
        editCollection,
        isSaving,
        deleteCollection,
        isDeleting
    } = useCollection(collectionId);

    const collectionName = collection?.name || "Collection not found";

    return (
        <>
            <Head>
                <title>{isLoading ? "Loading..." : collectionName}</title>
            </Head>
            <Layout user={user}>
                <Box px={4}>
                    <Skeleton
                        isLoaded={!isLoading}
                        w={isLoading ? "13rem" : undefined}>
                        <Breadcrumbs collectionName={collectionName} />
                    </Skeleton>

                    <Flex direction="column" gap={3} pt={8}>
                        <Skeleton
                            isLoaded={!isLoading}
                            w={isLoading ? "22rem" : undefined}>
                            <Heading>{collectionName}</Heading>
                        </Skeleton>

                        <Box color="gray.500">
                            <SkeletonText
                                isLoaded={!isLoading}
                                spacing="3"
                                skeletonHeight="2"
                                my={4}>
                                <Linkify
                                    componentDecorator={(
                                        decoratedHref,
                                        decoratedText,
                                        key
                                    ) => (
                                        <Link
                                            key={key}
                                            href={decoratedHref}
                                            target="_blank">
                                            {decoratedText}
                                        </Link>
                                    )}>
                                    {collection?.description}
                                </Linkify>
                            </SkeletonText>
                        </Box>
                        <Flex flexWrap="wrap" gap={2}>
                            {isLoading
                                ? Array.from({ length: 5 }).map((_, i) => (
                                      <Skeleton key={i} w="5rem" rounded="full">
                                          <TagChip tag={i.toString()} />
                                      </Skeleton>
                                  ))
                                : collection?.tags.map((tag) => (
                                      <TagChip key={tag} tag={tag} />
                                  ))}
                        </Flex>
                    </Flex>

                    <Box py={5}>
                        {collection && (
                            <CollectionModal
                                isSaving={isSaving}
                                onSave={editCollection}
                                initialCollection={collection}
                                mode="edit"
                                trigger={
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        color="gray.500"
                                        leftIcon={
                                            <Icon
                                                path={mdiSquareEditOutline}
                                                size={0.6}
                                            />
                                        }
                                        isDisabled={isLoading}>
                                        Edit collection
                                    </Button>
                                }
                            />
                        )}

                        <AreYouSureDialog
                            confirmLabel="Delete"
                            header={`Delete collection`}
                            isConfirming={isDeleting}
                            onConfirm={deleteCollection}
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    color="gray.500"
                                    leftIcon={
                                        <Icon path={mdiDelete} size={0.6} />
                                    }
                                    isLoading={isDeleting}
                                    isDisabled={isLoading}>
                                    Delete collection
                                </Button>
                            }>
                            Are you sure? You cannot undo this afterwards.
                        </AreYouSureDialog>
                    </Box>
                </Box>

                <CollectionGrid collectionId={collectionId} />
            </Layout>
        </>
    );
}

const Breadcrumbs = ({ collectionName }: { collectionName: string }) => (
    <Breadcrumb>
        <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/" fontWeight="semibold">
                Home
            </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbItem isCurrentPage>
            <Box color="gray.500">{collectionName}</Box>
        </BreadcrumbItem>
    </Breadcrumb>
);
