import { withSessionSsr } from "@/lib/common/iron-session";
import FrontPageCollections from "@/lib/components/FrontPageCollections";
import Layout from "@/lib/components/Layout";
import { Collection } from "@/lib/interfaces/collection";
import { User } from "@/lib/interfaces/user";
import { CollectionService } from "@/lib/services/collection.service";
import Head from "next/head";

export const getServerSideProps = withSessionSsr(
    async function getServerSideProps({ req }) {
        const collections = await new CollectionService(
            req.session.user.id
        ).getAll();
        return {
            props: {
                user: req.session.user,
                collections: collections
            }
        };
    }
);

export default function Home({
    user,
    collections
}: {
    user: User;
    collections: Collection[];
}) {
    return (
        <>
            <Head>
                <title>HomeWork</title>
            </Head>
            <Layout user={user}>
                <FrontPageCollections initialCollections={collections} />
            </Layout>
        </>
    );
}
