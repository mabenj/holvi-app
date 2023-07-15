import { withSessionSsr } from "@/lib/common/iron-session";
import { isUuidv4 } from "@/lib/common/utilities";
import Layout from "@/lib/components/Layout";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
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
import { useAtom } from "jotai";
import Head from "next/head";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { currentUser, rootCollection } from "../_app";

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

const fetcher = (url: string) =>
    fetch(url)
        .then((res) => res.json())
        .then((data) => data.collection as CollectionDto);

export default function CollectionPage({
    user,
    collectionId
}: {
    user: UserDto;
    collectionId: string;
}) {
    const { data, isLoading, error } = useSWRImmutable(
        `/api/collections/${collectionId}`,
        fetcher
    );
    const [collection, setCollection] = useAtom(rootCollection);
    const [_, setUser] = useAtom(currentUser);

    useEffect(() => setUser(user), [setUser, user]);

    useEffect(() => {
        if (!data) {
            return;
        }
        setCollection(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const collectionName = isLoading
        ? "Loading..."
        : collection?.name || collectionId;

    return (
        <>
            <Head>
                <title>{collectionName}</title>
            </Head>
            <Layout>
                <Breadcrumbs collectionName={collectionName} />
                <Flex direction="column" gap={3} px={4} pt={8}>
                    <Heading>{collectionName}</Heading>
                    <Flex gap={2}>
                        {collection?.tags.map((tag) => (
                            <CollectionTag key={tag} tag={tag} />
                        ))}
                    </Flex>
                </Flex>

                <Box py={5} />
                <CollectionGrid collectionId={collectionId} />
            </Layout>
        </>
    );
}

const Breadcrumbs = ({ collectionName }: { collectionName: string }) => (
    <Breadcrumb px={4}>
        <BreadcrumbItem>
            <BreadcrumbLink as={Link} href="/">
                Home
            </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbItem>
            <span>Collections</span>
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
