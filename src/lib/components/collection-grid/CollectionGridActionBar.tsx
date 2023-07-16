import { getErrorMessage } from "@/lib/common/utilities";
import useDebounce from "@/lib/hooks/useDebounce";
import { useUpload } from "@/lib/hooks/useUpload";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
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
import { ChangeEvent, Dispatch, useEffect, useRef, useState } from "react";
import CollectionModal from "../CollectionModal";
import { CollectionGridAction } from "./CollectionGrid";

interface CollectionGridActionBarProps {
    isLoading: boolean;
    actionDispatcher: Dispatch<CollectionGridAction>;
    collectionId?: string;
}

export default function CollectionGridActionBar({
    isLoading,
    actionDispatcher,
    collectionId
}: CollectionGridActionBarProps) {
    const [currentFilters, setCurrentFilters] = useState<string[]>([
        "collections",
        "videos",
        "images"
    ]);
    const [currentSort, setCurrentSort] = useState<{
        field: string;
        asc: boolean;
    } | null>(null);
    const { upload, isUploading, progress } = useUpload();

    const toast = useToast();

    const canFilter = collectionId === "root";
    const canListFiles = collectionId === "root";
    const canUploadFiles = collectionId && collectionId !== "root";
    const canUploadCollection = collectionId === "root";
    const canCreateCollection = collectionId === "root";

    const handleSearch = async (query: string) => {
        if (!collectionId) {
            return;
        }
        if (collectionId === "root") {
            actionDispatcher({ type: "SEARCH_START" });
            //TODO: make request to server
            actionDispatcher({
                type: "SEARCH_SUCCESS",
                collections: [],
                files: []
            });
            return;
        }
        // necessary data already at client, filter grid items based on query
        actionDispatcher({ type: "FILTER", filters: currentFilters, query });
    };

    const handleListFiles = () => {
        actionDispatcher({ type: "SEARCH_START" });
        //TODO: make request to server
        actionDispatcher({
            type: "SEARCH_SUCCESS",
            collections: [],
            files: []
        });
    };

    const handleUploadFiles = async (
        files: File[],
        collectionName?: string
    ) => {
        if (files.length === 0) {
            toast({
                description: "No files selected",
                status: "error"
            });
            return;
        }
        const isCreatingNew = !!collectionName;
        const formData = new FormData();
        files.forEach((file) => formData.append("file", file));
        const url = isCreatingNew
            ? `/api/collections/upload?name=${collectionName}`
            : `/api/collections/${collectionId}/files/upload`;
        const response = await upload(formData, url, "POST").catch((error) => ({
            status: "error",
            error
        }));
        if (response.status === "error" || response.error) {
            toast({
                description: `Error uploading ${
                    isCreatingNew ? "collection" : "files"
                }: ${getErrorMessage(response.error)}`,
                status: "error"
            });
            return;
        }
        const newItems = isCreatingNew ? [response.collection] : response.files;
        actionDispatcher({ type: "ADD", items: newItems });
        toast({
            description: `Successfully uploaded ${
                isCreatingNew
                    ? `collection ${response.collection.name}`
                    : `${response.files.length} files`
            }`,
            status: "success"
        });
    };

    const handleFilter = (filters: string[]) => {
        setCurrentFilters(filters);
        actionDispatcher({ type: "FILTER", filters });
    };

    const handleSort = (field: string, asc: boolean) => {
        setCurrentSort({ field, asc });
        actionDispatcher({ type: "SORT", field, asc });
    };

    const handleCreated = (collection: CollectionDto) => {
        actionDispatcher({
            type: "ADD",
            items: [{ ...collection, type: "collection" }]
        });
    };

    return (
        <>
            <Flex alignItems="center" gap={2} px={2}>
                <Box flexGrow={1}>
                    <SearchBar onSearch={handleSearch} disabled={isLoading} />
                </Box>
                {canFilter && (
                    <FilterBtn
                        filters={currentFilters}
                        onFilter={handleFilter}
                        disabled={isLoading}
                    />
                )}
                <SortBtn onSort={handleSort} disabled={isLoading} />
                {canListFiles && (
                    <ListAllFilesBtn
                        onClick={handleListFiles}
                        disabled={isLoading}
                    />
                )}
                {canUploadFiles && (
                    <UploadFilesBtn
                        onUpload={handleUploadFiles}
                        disabled={isLoading}
                    />
                )}
                {canUploadCollection && (
                    <UploadCollectionBtn
                        onUpload={handleUploadFiles}
                        disabled={isLoading}
                    />
                )}
                {canCreateCollection && (
                    <CreateCollectionBtn
                        onCreated={handleCreated}
                        disabled={isLoading}
                    />
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

const ListAllFilesBtn = ({
    onClick,
    disabled
}: {
    onClick: () => void;
    disabled: boolean;
}) => {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            title="List all files"
            disabled={disabled}>
            All files
        </Button>
    );
};

const FilterBtn = ({
    filters,
    onFilter,
    disabled
}: {
    filters: string[];
    onFilter: (filters: string[]) => void;
    disabled: boolean;
}) => {
    const handleFilter = (e: string | string[]) => {
        const filters = Array.isArray(e) ? e : [e];
        onFilter(filters);
    };

    return (
        <Menu closeOnSelect={false}>
            <MenuButton
                as={IconButton}
                icon={<Icon path={mdiFilterVariant} size={1} />}
                variant="ghost"
                title="Filter"
                disabled={disabled}
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
    onSort,
    disabled
}: {
    onSort: (field: "name" | "timestamp", asc: boolean) => void;
    disabled: boolean;
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
                disabled={disabled}
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
    onUpload,
    disabled
}: {
    onUpload: (files: File[], folderName: string) => void;
    disabled: boolean;
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const name =
            files[0].webkitRelativePath.split("/")[0] || "New collection";
        onUpload(files, name);
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
                disabled={disabled}
            />
        </div>
    );
};

const UploadFilesBtn = ({
    onUpload,
    disabled
}: {
    onUpload: (files: File[]) => void;
    disabled: boolean;
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
                disabled={disabled}
            />
        </div>
    );
};

const CreateCollectionBtn = ({
    onCreated,
    disabled
}: {
    onCreated: (collection: CollectionDto) => void;
    disabled: boolean;
}) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button
                onClick={onOpen}
                leftIcon={<AddIcon />}
                title="Create a new collection"
                disabled={disabled}>
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

const SearchBar = ({
    onSearch,
    disabled
}: {
    onSearch: (query: string) => void;
    disabled: boolean;
}) => {
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
                disabled={disabled}
            />
        </InputGroup>
    );
};
