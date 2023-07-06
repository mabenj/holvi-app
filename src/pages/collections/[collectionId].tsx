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
    BreadcrumbLink
} from "@chakra-ui/react";
import Head from "next/head";

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
                <Box py={5} />
                <CollectionGrid rootCollectionId={collectionId} />
            </Layout>
        </>
    );
};

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
