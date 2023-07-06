import { withSessionSsr } from "@/lib/common/iron-session";
import { isUuidv4 } from "@/lib/common/utilities";
import Layout from "@/lib/components/Layout";
import { useUpload } from "@/lib/hooks/useUpload";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { UserDto } from "@/lib/interfaces/user-dto";
import { Image, Link } from "@chakra-ui/next-js";
import {
    Box,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    Button,
    Progress
} from "@chakra-ui/react";
import { mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
    const { data, error, isLoading } = useSWR(
        `/api/collections/${collectionId}/files`,
        fetcher
    );

    const [currentCollection, setCurrentCollection] = useState<
        CollectionDto | undefined
    >();
    const [files, setFiles] = useState<CollectionFileDto[]>([]);

    const { upload, progress, isUploading } = useUpload(
        "POST",
        `/api/collections/${currentCollection?.id}/files/upload`
    );

    useEffect(() => {
        if (!data) {
            return;
        }
        setCurrentCollection(data.collection);
        setFiles(data.files || []);
    }, [data]);

    const handleUpload = async (files: FileList | null) => {
        const fileList = Array.from(files || []);
        if (!currentCollection || fileList.length === 0) {
            return;
        }
        try {
            let formData = new FormData();
            fileList.forEach((file) => formData.append("media", file));
            const response = await upload(formData);
            alert(JSON.stringify(response));
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
                <Box py={5} />
                <UploadFilesBtn onUpload={handleUpload} />
                <Box py={5} />

                {progress && isUploading ? (
                    <Progress
                        hasStripe
                        size="xs"
                        value={progress}
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                    />
                ) : null}

                {files.map((file) => (
                    <Image
                        key={file.id}
                        src={file.src}
                        alt={file.name}
                        width={file.width}
                        height={file.height}
                    />
                ))}
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
