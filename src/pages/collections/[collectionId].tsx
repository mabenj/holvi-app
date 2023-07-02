import { withSessionSsr } from "@/lib/common/iron-session";
import Layout from "@/lib/components/Layout";
import { Collection } from "@/lib/interfaces/collection";
import { User } from "@/lib/interfaces/user";
import { CollectionService } from "@/lib/services/collection.service";
import Head from "next/head";

export const getServerSideProps = withSessionSsr(
    async function getServerSideProps({ req, query }) {
        const { collectionId } = query;
        const { collection, notFound } = await new CollectionService(req.session.user.id).get(
            parseInt(collectionId?.toString() || "")
        );
        if(!collection || notFound){
            return {
                notFound: true
            }
        }
        return {
            props: {
                user: req.session.user,
                collection: collection
            }
        };
    }
);

export default function CollectionPage({
    user,
    collection
}: {
    user: User;
    collection: Collection;
}) {
    return (
        <>
            <Head>
                <title>Collection {collection.name}</title>
            </Head>
            <Layout user={user}>
                {/* <FrontPageCollections initialCollections={collections} /> */}
                <pre>{JSON.stringify(collection, null, 2)}</pre>
            </Layout>
        </>
    );
}
