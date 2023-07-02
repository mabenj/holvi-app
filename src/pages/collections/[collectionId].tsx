import { withSessionSsr } from "@/lib/common/iron-session";
import Layout from "@/lib/components/Layout";
import { useCollections } from "@/lib/context/CollectionsContext";
import { Collection } from "@/lib/interfaces/collection";
import { User } from "@/lib/interfaces/user";
import { Link } from "@chakra-ui/next-js";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink } from "@chakra-ui/react";
import Head from "next/head";
import { useEffect, useState } from "react";

export const getServerSideProps = withSessionSsr(
    async function getServerSideProps({ req, query }) {
        const collectionId = parseInt(query.collectionId?.toString() || "");
        if (isNaN(collectionId)) {
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
    user: User;
    collectionId: number;
}) {
    const [currentCollection, setCurrentCollection] = useState<
        Collection | undefined
    >();
    const { collections } = useCollections();

    useEffect(
        () =>
            setCurrentCollection(
                collections.find((c) => c.id === collectionId)
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [collections]
    );

    return (
        <>
            <Head>
                <title>{currentCollection?.name}</title>
            </Head>
            <Layout user={user}>
                <Breadcrumbs collectionName={currentCollection?.name || ""} />
            </Layout>
        </>
    );
}

const Breadcrumbs = ({ collectionName }: { collectionName: string }) => (
    <Breadcrumb>
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
