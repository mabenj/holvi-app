import { withUserSsr } from "@/lib/common/route-helpers";
import Layout from "@/lib/components/Layout";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import { UserDto } from "@/lib/interfaces/user-dto";
import { useAtom } from "jotai";
import Head from "next/head";
import { useEffect } from "react";
import { currentUser, rootCollection } from "./_app";

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
    const [_, setUser] = useAtom(currentUser);
    const [collection, setCollection] = useAtom(rootCollection);

    useEffect(() => setCollection(null), [setCollection]);

    useEffect(() => setUser(user), [setUser, user]);

    return (
        <>
            <Head>
                <title>Holvi</title>
            </Head>
            <Layout>
                <CollectionGrid collectionId="root" />
            </Layout>
        </>
    );
}
