import { GridSort } from "@/lib/hooks/useCollectionGrid";
import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
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
    useDisclosure
} from "@chakra-ui/react";
import { mdiFilterVariant, mdiFolderUpload, mdiSort, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import CollectionModal from "../modals/CollectionModal";

interface CollectionGridActionBarProps {
    isLoading: boolean;
    collectionId: string;
    sort: GridSort;
    onSort: (sort: GridSort) => void;
    filters: string[];
    onFilter: (filters: string[]) => void;
    searchQuery: string;
    onSearch: (query: string) => void;
    onUpload: (files: File[], name?: string) => void;
    onCreated: (collection: CollectionGridItem) => void;
    onListFiles: () => void;
}

export default function CollectionGridActionBar({
    isLoading,
    collectionId,
    sort,
    onSort,
    filters,
    onFilter,
    searchQuery,
    onSearch,
    onUpload,
    onCreated,
    onListFiles
}: CollectionGridActionBarProps) {
    const canFilter = collectionId === "root";
    const canListFiles = collectionId === "root";
    const canUploadFiles = collectionId !== "root";
    const canUploadCollection = collectionId === "root";
    const canCreateCollection = collectionId === "root";

    return (
        <>
            <Flex
                alignItems="center"
                direction={["column", "column", "row"]}
                w="100%"
                gap={2}
                px={2}>
                <Box flexGrow={1} w="100%">
                    <SearchBar query={searchQuery} onSearch={onSearch} />
                </Box>
                <Flex alignItems="center" gap={2}>
                    {canFilter && (
                        <FilterBtn
                            filters={filters}
                            onFilter={onFilter}
                            disabled={isLoading}
                        />
                    )}
                    <SortBtn sort={sort} onSort={onSort} disabled={isLoading} />
                    {canListFiles && (
                        <ListAllFilesBtn
                            onClick={onListFiles}
                            disabled={isLoading}
                        />
                    )}
                    {canUploadFiles && (
                        <UploadFilesBtn
                            onUpload={onUpload}
                            disabled={isLoading}
                        />
                    )}
                    {canUploadCollection && (
                        <UploadCollectionBtn
                            onUpload={onUpload}
                            disabled={isLoading}
                        />
                    )}
                    {canCreateCollection && (
                        <CreateCollectionBtn
                            onCreated={onCreated}
                            disabled={isLoading}
                        />
                    )}
                </Flex>
            </Flex>
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
            isDisabled={disabled}>
            List files
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
                isDisabled={disabled}
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
    sort,
    onSort,
    disabled
}: {
    sort: GridSort;
    onSort: (sort: GridSort) => void;
    disabled: boolean;
}) => {
    const [sortValue, setSortValue] = useState("");

    useEffect(() => {
        setSortValue(`${sort.asc ? "+" : "-"}${sort.field}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sort]);

    const handleSort = (e: string | string[]) => {
        const sortField = Array.isArray(e) ? e[0] : e;
        const field = sortField.substring(1);
        if (field !== "name" && field !== "timestamp") {
            return;
        }
        setSortValue(sortField);
        onSort({
            field: field,
            asc: sortField.startsWith("+")
        });
    };

    return (
        <Menu>
            <MenuButton
                as={IconButton}
                icon={<Icon path={mdiSort} size={1} />}
                variant="ghost"
                title="Sort"
                isDisabled={disabled}
            />
            <MenuList>
                <MenuOptionGroup
                    type="radio"
                    onChange={handleSort}
                    value={sortValue}>
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
            files[0]?.webkitRelativePath.split("/")[0] || "New collection";
        onUpload(files, name);
        if (fileInputRef.current?.value) {
            fileInputRef.current.value = "";
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
                isDisabled={disabled}
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
        if (fileInputRef.current?.value) {
            fileInputRef.current.value = "";
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
            <Button
                leftIcon={<Icon path={mdiUpload} size={1} />}
                isDisabled={disabled}
                onClick={() => fileInputRef?.current?.click()}>
                Upload
            </Button>
        </div>
    );
};

const CreateCollectionBtn = ({
    onCreated,
    disabled
}: {
    onCreated: (collection: CollectionGridItem) => void;
    disabled: boolean;
}) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button
                onClick={onOpen}
                leftIcon={<AddIcon />}
                title="Create a new collection"
                isDisabled={disabled}>
                Create
            </Button>
            <CollectionModal
                isOpen={isOpen}
                onClose={onClose}
                onSave={(collection) =>
                    onCreated({ ...collection, type: "collection" })
                }
                mode="create"
            />
        </>
    );
};

const SearchBar = ({
    query,
    onSearch
}: {
    query: string;
    onSearch: (query: string) => void;
}) => {
    return (
        <InputGroup>
            <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
                type="search"
                placeholder="Search..."
                value={query || ""}
                onChange={(e) => onSearch(e.target.value)}
            />
        </InputGroup>
    );
};
