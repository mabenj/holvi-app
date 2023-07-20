import { withUserSsr } from "@/lib/common/route-helpers";
import Layout from "@/lib/components/Layout";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import { UserDto } from "@/lib/interfaces/user-dto";
import Head from "next/head";

export const getServerSideProps = withUserSsr(
    async function getServerSideProps({ req }) {
        return {
            props: {
                user: req.session.user
            }
        };
    }
);

export default function Home({ user }: { user: UserDto }) {
    return (
        <>
            <Head>
                <title>Holvi</title>
            </Head>
            <Layout user={user}>
                <CollectionGrid collectionId="root" />
            </Layout>
        </>
    );
}
