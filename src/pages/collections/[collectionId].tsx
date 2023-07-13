import { withSessionSsr } from "@/lib/common/iron-session";
import { isUuidv4 } from "@/lib/common/utilities";
import Layout from "@/lib/components/Layout";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { UserDto } from "@/lib/interfaces/user-dto";
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
        const collectionId = query.collectionId?.toString();
        if (!collectionId || !isUuidv4(collectionId)) {
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
    return (
        <CollectionGridProvider rootCollectionId={collectionId}>
            <PageContent user={user} collectionId={collectionId} />
        </CollectionGridProvider>
    );
}
const PageContent = ({
    user,
    collectionId
}: {
    user: UserDto;
    collectionId: string;
}) => {
    const { rootCollection, isLoading } = useCollectionGrid();
    return (
        <>
            <Head>
                <title>{rootCollection?.name}</title>
            </Head>
            <Layout user={user}>
                <Breadcrumbs
                    collectionName={
                        isLoading
                            ? "Loading..."
                            : rootCollection?.name || collectionId
                    }
                />

                {rootCollection && (
                    <Flex direction="column" gap={3} px={4} pt={8}>
                        <Heading>{rootCollection.name}</Heading>
                        <Flex gap={2}>
                            {rootCollection.tags.map((tag) => (
                                <CollectionTag key={tag} tag={tag} />
                            ))}
                        </Flex>
                    </Flex>
                )}

                <Box py={5} />
                <CollectionGrid rootCollectionId={collectionId} />
            </Layout>
        </>
    );
};

const Breadcrumbs = ({ collectionName }: { collectionName: string }) => (
    <Breadcrumb px={4}>
        <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/">
                Home
            </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/">
                Collections
            </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>{collectionName}</BreadcrumbLink>
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
