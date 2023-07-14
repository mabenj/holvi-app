import {
    caseInsensitiveSorter,
    collectionsToGridItems,
    filesToGridItems,
    getErrorMessage
} from "@/lib/common/utilities";
import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import useDebounce from "@/lib/hooks/useDebounce";
import { useUpload } from "@/lib/hooks/useUpload";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { AddIcon, SearchIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Flex,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
    Menu,
    MenuButton,
    MenuItemOption,
    MenuList,
    MenuOptionGroup,
    Progress,
    useDisclosure,
    useToast
} from "@chakra-ui/react";
import { mdiFilterVariant, mdiFolderUpload, mdiSort, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import CollectionModal from "../CollectionModal";

interface GridFilters {
    collections: boolean;
    videos: boolean;
    images: boolean;
}

export default function CollectionGridActionBar() {
    const { rootCollectionId, setGridItems, isLoading } = useCollectionGrid();
    const { upload, isUploading, progress } = useUpload(
        "POST",
        `/api/collections/${rootCollectionId}/files/upload`
    );

    const toast = useToast();

    const canFilter = rootCollectionId === "root";
    const canListFiles = rootCollectionId === "root";
    const canUploadFiles = rootCollectionId !== "root";
    const canUploadCollection = rootCollectionId === "root";
    const canCreateCollection = rootCollectionId === "root";

    const handleSearch = async (query: string) => {
        alert(`SEARCH: ${query}`);
        if (!rootCollectionId) {
            //TODO: make request to server
            return;
        }
        // TODO: necessary data already at client, filter grid items based on query
    };

    const handleFilter = (filters: GridFilters) => {
        alert(`FILTER: ${JSON.stringify(filters)}`);
        //TODO
    };

    const handleSort = (field: "name" | "timestamp", asc: boolean) => {
        switch (field) {
            case "name": {
                setGridItems((prev) => [
                    ...prev.sort(caseInsensitiveSorter("name", asc))
                ]);
                break;
            }
            case "timestamp": {
                setGridItems((prev) => [
                    ...prev.sort(caseInsensitiveSorter("timestamp", asc))
                ]);
                break;
            }
            default:
                toast({
                    description: `Cannot sort by '${field}'`,
                    status: "error"
                });
        }
    };

    const handleListFiles = () => {
        alert("LIST ALL FILES");
    };

    const handleUploadFiles = async (files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("file", file));
        const response = await upload(formData);
        if (response.status === "error" || response.error) {
            toast({
                description: `Error uploading files: ${getErrorMessage(
                    response.error
                )}`,
                status: "error"
            });
            return;
        }
        setGridItems((prev) => [
            ...prev,
            ...filesToGridItems(response.files as CollectionFileDto[])
        ]);
        toast({
            description: `Successfully uploaded ${response.files.length} files`,
            status: "success"
        });
    };

    const handleUploadCollection = (name: string, files: File[]) => {
        alert(`UPLOAD COLLECTION: ${name}`);
        //TODO
    };

    const onCollectionCreated = (collection: CollectionDto) => {
        setGridItems((prev) => [
            ...prev,
            ...collectionsToGridItems([collection])
        ]);
    };

    return (
        <>
            <Flex alignItems="center" gap={2} px={2}>
                <Box flexGrow={1}>
                    <SearchBar onSearch={handleSearch} />
                </Box>
                {canFilter && <FilterBtn onFilter={handleFilter} />}
                <SortBtn onSort={handleSort} />
                {canListFiles && <ListAllFilesBtn onClick={handleListFiles} />}
                {canUploadFiles && (
                    <UploadFilesBtn onUpload={handleUploadFiles} />
                )}
                {canUploadCollection && (
                    <UploadCollectionBtn onUpload={handleUploadCollection} />
                )}
                {canCreateCollection && (
                    <CreateCollectionBtn onCreated={onCollectionCreated} />
                )}
            </Flex>
            {isUploading && (
                <Progress
                    value={progress}
                    size="xs"
                    hasStripe
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                />
            )}
        </>
    );
}

const ListAllFilesBtn = ({ onClick }: { onClick: () => void }) => {
    return (
        <Button variant="ghost" onClick={onClick} title="List all files">
            All files
        </Button>
    );
};

const FilterBtn = ({
    onFilter
}: {
    onFilter: (filters: GridFilters) => void;
}) => {
    const [filters, setFilters] = useState<string[]>([
        "collections",
        "videos",
        "images"
    ]);

    const handleFilter = (e: string | string[]) => {
        const filters = Array.isArray(e) ? e : [e];
        setFilters(filters);
        onFilter({
            collections: filters.includes("collections"),
            videos: filters.includes("videos"),
            images: filters.includes("images")
        });
    };

    return (
        <Menu closeOnSelect={false}>
            <MenuButton
                as={IconButton}
                icon={<Icon path={mdiFilterVariant} size={1} />}
                variant="ghost"
                title="Filter"
            />
            <MenuList>
                <MenuOptionGroup
                    type="checkbox"
                    onChange={handleFilter}
                    value={filters}>
                    <MenuItemOption value="collections">
                        Collections
                    </MenuItemOption>
                    <MenuItemOption value="videos">Videos</MenuItemOption>
                    <MenuItemOption value="images">Images</MenuItemOption>
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const SortBtn = ({
    onSort
}: {
    onSort: (field: "name" | "timestamp", asc: boolean) => void;
}) => {
    const [sortField, setSortField] = useState("");

    const handleSort = (e: string | string[]) => {
        const sortField = Array.isArray(e) ? e[0] : e;
        const field = sortField.substring(1);
        if (field !== "name" && field !== "timestamp") {
            return;
        }
        setSortField(sortField);
        onSort(field, sortField.startsWith("+"));
    };

    return (
        <Menu>
            <MenuButton
                as={IconButton}
                icon={<Icon path={mdiSort} size={1} />}
                variant="ghost"
                title="Sort"
            />
            <MenuList>
                <MenuOptionGroup
                    type="radio"
                    onChange={handleSort}
                    value={sortField}>
                    <MenuItemOption value="+name">Name (A-Z)</MenuItemOption>
                    <MenuItemOption value="-name">Name (Z-A)</MenuItemOption>
                    <MenuItemOption value="-timestamp">
                        Newest first
                    </MenuItemOption>
                    <MenuItemOption value="+timestamp">
                        Oldest first
                    </MenuItemOption>
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const UploadCollectionBtn = ({
    onUpload
}: {
    onUpload: (name: string, files: File[]) => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const name =
            files[0].webkitRelativePath.split("/")[0] || "New collection";
        onUpload(name, files);
        if (fileInputRef.current) {
            fileInputRef.current.files = null;
        }
    };

    return (
        <div>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                {...{
                    webkitdirectory: "true",
                    mozdirectory: "true",
                    directory: "true"
                }}
                onChange={handleUpload}
            />
            <IconButton
                aria-label="Upload collection"
                title="Upload collection"
                variant="ghost"
                onClick={() => fileInputRef?.current?.click()}
                icon={<Icon path={mdiFolderUpload} size={1} />}
            />
        </div>
    );
};

const UploadFilesBtn = ({
    onUpload
}: {
    onUpload: (files: File[]) => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        onUpload(files);
        if (fileInputRef.current) {
            fileInputRef.current.files = null;
        }
    };

    return (
        <div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                multiple
                onChange={handleUpload}
            />
            <IconButton
                aria-label="Upload files"
                title="Upload files"
                variant="ghost"
                onClick={() => fileInputRef?.current?.click()}
                icon={<Icon path={mdiUpload} size={1} />}
            />
        </div>
    );
};

const CreateCollectionBtn = ({
    onCreated
}: {
    onCreated: (collection: CollectionDto) => void;
}) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button
                onClick={onOpen}
                leftIcon={<AddIcon />}
                title="Create a new collection">
                Create
            </Button>
            <CollectionModal
                isOpen={isOpen}
                onClose={onClose}
                onSave={onCreated}
                mode="create"
            />
        </>
    );
};

const SearchBar = ({ onSearch }: { onSearch: (query: string) => void }) => {
    const DEBOUNCE_MS = 500;
    const [query, setQuery] = useState<string | null>(null);
    const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

    useEffect(() => {
        if (debouncedQuery == null) {
            return;
        }
        onSearch(debouncedQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);

    return (
        <InputGroup>
            <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
                type="search"
                placeholder="Search..."
                value={query || ""}
                onChange={(e) => setQuery(e.target.value)}
            />
        </InputGroup>
    );
};
