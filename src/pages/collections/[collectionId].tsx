import { NotFoundError } from "@/lib/common/errors";
import { withSessionSsr } from "@/lib/common/iron-session";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import Layout from "@/lib/components/ui/Layout";
import TagChip from "@/lib/components/ui/TagChip";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import { UserDto } from "@/lib/types/user-dto";
import { Link } from "@chakra-ui/next-js";
import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Button,
    Flex,
    Heading
} from "@chakra-ui/react";
import { mdiDelete, mdiSquareEditOutline } from "@mdi/js";
import Icon from "@mdi/react";
import Head from "next/head";
import Linkify from "react-linkify";

export const getServerSideProps = withSessionSsr(
    async function getServerSideProps({ req, query }) {
        const { collectionId } = query as { collectionId: string };
        try {
            const collection = await new CollectionService(
                req.session.user.id
            ).getCollection(collectionId);
            return {
                props: {
                    user: req.session.user,
                    collection: collection
                }
            };
        } catch (error) {
            if (error instanceof NotFoundError) {
                return {
                    notFound: true
                };
            }
            throw new Error("Internal server error");
        }
    }
);

export default function CollectionPage({
    user,
    collection
}: {
    user: UserDto;
    collection: CollectionDto;
}) {
    return (
        <>
            <Head>
                <title>{collection.name}</title>
            </Head>
            <Layout user={user}>
                <Breadcrumbs collectionName={collection.name} />
                <Flex direction="column" gap={3} px={4} pt={8}>
                    <Heading>{collection.name}</Heading>

                    <Box color="gray.500">
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
                            {collection.description}
                        </Linkify>
                    </Box>
                    <Flex gap={2}>
                        {collection.tags.map((tag) => (
                            <TagChip key={tag} tag={tag} />
                        ))}
                    </Flex>
                </Flex>

                <Box py={5}>
                    <Button
                        variant="ghost"
                        size="sm"
                        color="gray.500"
                        leftIcon={
                            <Icon path={mdiSquareEditOutline} size={0.6} />
                        }>
                        Edit collection
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        color="gray.500"
                        leftIcon={<Icon path={mdiDelete} size={0.6} />}>
                        Delete collection
                    </Button>
                </Box>

                <CollectionGrid collectionId={collection.id} />
            </Layout>
        </>
    );
}

const Breadcrumbs = ({ collectionName }: { collectionName: string }) => (
    <Breadcrumb px={4}>
        <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/" fontWeight="semibold">
                Home
            </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbItem>
            <Box color="gray.500">Collections</Box>
        </BreadcrumbItem>

        <BreadcrumbItem isCurrentPage>
            <Box color="gray.500">{collectionName}</Box>
        </BreadcrumbItem>
    </Breadcrumb>
);
