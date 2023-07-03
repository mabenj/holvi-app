import { withSessionSsr } from "@/lib/common/iron-session";
import Layout from "@/lib/components/Layout";
import { useCollections } from "@/lib/context/CollectionsContext";
import { Collection } from "@/lib/interfaces/collection";
import { User } from "@/lib/interfaces/user";
import { Link } from "@chakra-ui/next-js";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Button
} from "@chakra-ui/react";
import { mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";

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

    const upload = async (files: FileList | null) => {
        const fileList = Array.from(files || []);
        if (!currentCollection || fileList.length === 0) {
            return;
        }
        try {
            let formData = new FormData();
            fileList.forEach((file) => formData.append("media", file));
            const res = await fetch(
                `/api/collections/${currentCollection.id}/files/upload`,
                { method: "PUT", body: formData }
            );
            const data = await res.json();
            alert(data);
        } catch (error) {
            alert(JSON.stringify(error));
        }
    };

    return (
        <>
            <Head>
                <title>{currentCollection?.name}</title>
            </Head>
            <Layout user={user}>
                <Breadcrumbs collectionName={currentCollection?.name || ""} />
                <UploadFilesBtn onUpload={upload} />
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

const UploadFilesBtn = ({
    onUpload
}: {
    onUpload: (files: FileList | null) => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => onUpload(e.target.files)}
                multiple
            />
            <Button
                onClick={() => fileInputRef?.current?.click()}
                leftIcon={<Icon path={mdiUpload} size={1} />}>
                Upload files
            </Button>
        </div>
    );
};
