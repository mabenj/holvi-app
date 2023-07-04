import { withUserSsr } from "@/lib/common/route-helpers";
import CollectionModal from "@/lib/components/CollectionModal";
import Layout from "@/lib/components/Layout";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import { User } from "@/lib/interfaces/user";
import { AddIcon } from "@chakra-ui/icons";
import { Button, Flex, useDisclosure } from "@chakra-ui/react";
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

export default function Home({ user }: { user: User }) {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Head>
                <title>Holvi</title>
            </Head>
            <Layout user={user}>
                <Flex direction="column" gap={10}>
                    <CollectionGrid />
                    <Button onClick={onOpen} leftIcon={<AddIcon />}>
                        Create Collection
                    </Button>
                    <CollectionModal
                        isOpen={isOpen}
                        onClose={onClose}
                        mode="create"
                    />
                </Flex>
            </Layout>
        </>
    );
}
