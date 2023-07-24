import { NotFoundError } from "@/lib/common/errors";
import { withSessionSsr } from "@/lib/common/iron-session";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import Layout from "@/lib/components/ui/Layout";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import { UserDto } from "@/lib/types/user-dto";
import { Link } from "@chakra-ui/next-js";
import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Flex,
    Heading,
    Tag
} from "@chakra-ui/react";
import Head from "next/head";
import { useEffect, useState } from "react";

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
                    <Flex gap={2}>
                        {collection.tags.map((tag) => (
                            <CollectionTag key={tag} tag={tag} />
                        ))}
                    </Flex>
                </Flex>

                <Box py={5} />
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

const CollectionTag = ({ tag }: { tag: string }) => {
    const [color, setColor] = useState(COLOR_SCHEMES[0]);

    useEffect(() => {
        let random = 0;
        for (let i = 0; i < tag.length; i++) {
            random += tag.charCodeAt(i);
        }
        setColor(COLOR_SCHEMES[random % COLOR_SCHEMES.length]);
    }, [tag]);

    return (
        <Tag borderRadius="full" colorScheme={color}>
            {tag}
        </Tag>
    );
};

const COLOR_SCHEMES = [
    "gray",
    "red",
    "orange",
    "yellow",
    "green",
    "teal",
    "blue",
    "cyan",
    "purple",
    "pink",
    "linkedin",
    "facebook",
    "messenger",
    "whatsapp",
    "twitter",
    "telegram"
];
