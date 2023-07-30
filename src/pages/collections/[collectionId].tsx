import { NotFoundError } from "@/lib/common/errors";
import { withSessionSsr } from "@/lib/common/iron-session";
import CollectionGrid from "@/lib/components/collection-grid/CollectionGrid";
import CollectionModal from "@/lib/components/modals/CollectionModal";
import AreYouSureDialog from "@/lib/components/ui/AreYouSureDialog";
import Layout from "@/lib/components/ui/Layout";
import TagChip from "@/lib/components/ui/TagChip";
import { useCollections } from "@/lib/hooks/useCollections";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import { UserDto } from "@/lib/types/user-dto";
import { CollectionFormData } from "@/lib/validators/collection.validator";
import { Link } from "@chakra-ui/next-js";
import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Button,
    Flex,
    Heading,
    useDisclosure
} from "@chakra-ui/react";
import { mdiDelete, mdiSquareEditOutline } from "@mdi/js";
import Icon from "@mdi/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import Linkify from "react-linkify";

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
    const [currentCollection, setCurrentCollection] = useState(collection);
    const { editCollection, isSaving, deleteCollection, isDeleting } =
        useCollections();

    const {
        isOpen: isModalOpen,
        onOpen: onModalOpen,
        onClose: onModalClose
    } = useDisclosure();

    const {
        isOpen: isAlertOpen,
        onOpen: onAlertOpen,
        onClose: onAlertClose
    } = useDisclosure();

    const router = useRouter();

    const handleSaveCollection = async (
        data: CollectionFormData,
        id?: string
    ) => {
        const edited = await editCollection(data, id!);
        if ("nameError" in edited) {
            return edited;
        }
        setCurrentCollection(edited);
        return edited;
    };

    const handleDeleteCollection = async () => {
        await deleteCollection(currentCollection);
        await router.push("/");
    };

    return (
        <>
            <Head>
                <title>{currentCollection.name}</title>
            </Head>
            <Layout user={user}>
                <Breadcrumbs collectionName={currentCollection.name} />
                <Flex direction="column" gap={3} px={4} pt={8}>
                    <Heading>{currentCollection.name}</Heading>

                    <Box color="gray.500">
                        <Linkify
                            componentDecorator={(
                                decoratedHref,
                                decoratedText,
                                key
                            ) => (
                                <Link
                                    key={key}
                                    href={decoratedHref}
                                    target="_blank">
                                    {decoratedText}
                                </Link>
                            )}>
                            {currentCollection.description}
                        </Linkify>
                    </Box>
                    <Flex flexWrap="wrap" gap={2}>
                        {currentCollection.tags.map((tag) => (
                            <TagChip key={tag} tag={tag} />
                        ))}
                    </Flex>
                </Flex>

                <Box py={5}>
                    <Button
                        variant="ghost"
                        size="sm"
                        color="gray.500"
                        leftIcon={
                            <Icon path={mdiSquareEditOutline} size={0.6} />
                        }
                        onClick={onModalOpen}>
                        Edit collection
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        color="gray.500"
                        leftIcon={<Icon path={mdiDelete} size={0.6} />}
                        onClick={onAlertOpen}
                        isLoading={isDeleting}>
                        Delete collection
                    </Button>
                </Box>

                <CollectionGrid collectionId={collection.id} />
            </Layout>

            <CollectionModal
                isOpen={isModalOpen}
                onClose={onModalClose}
                isSaving={isSaving}
                onSave={handleSaveCollection}
                initialCollection={currentCollection}
                mode="edit"
            />

            <AreYouSureDialog
                confirmLabel="Delete"
                header={`Delete collection`}
                isConfirming={isDeleting}
                isOpen={isAlertOpen}
                onClose={onAlertClose}
                onConfirm={handleDeleteCollection}>
                Are you sure? You cannot undo this afterwards.
            </AreYouSureDialog>
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
