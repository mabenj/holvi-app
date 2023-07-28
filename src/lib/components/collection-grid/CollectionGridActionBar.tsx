import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { AddIcon, SearchIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Divider,
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
    Tag,
    useDisclosure
} from "@chakra-ui/react";
import { mdiFilterVariant, mdiFolderUpload, mdiSort, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import CollectionModal from "../modals/CollectionModal";
import TagChip from "../ui/TagChip";

interface CollectionGridActionBarProps {
    collectionId: string;
}

export default function CollectionGridActionBar({
    collectionId
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
                    <SearchBar />
                </Box>
                <Flex alignItems="center" gap={2}>
                    {canFilter && <FilterBtn />}
                    <SortBtn />
                    {canListFiles && <ListAllFilesBtn />}
                    {canUploadFiles && <UploadFilesBtn />}
                    {canUploadCollection && <UploadCollectionBtn />}
                    {canCreateCollection && <CreateCollectionBtn />}
                </Flex>
            </Flex>
        </>
    );
}

const ListAllFilesBtn = () => {
    return <></>;
    // TODO: maybe some day?
    // const {
    //     isLoading,
    // } = useCollectionGrid();

    // return (
    //     <Button
    //         variant="ghost"
    //         onClick={toggleIsFileOnly}
    //         title="List all files"
    //         isDisabled={isLoading}>
    //         {isFileOnly ? "List collections" : "List files"}
    //     </Button>
    // );
};

const FilterBtn = () => {
    const {
        actions: { filterTags: filter },
        tags,
        isLoading,
        searchRequest: { tags: filters }
    } = useCollectionGrid();

    const handleFilter = (e: string | string[]) => {
        const filters = Array.isArray(e) ? e : [e];
        filter(filters);
    };

    return (
        <Menu closeOnSelect={false}>
            <MenuButton
                as={IconButton}
                icon={
                    <Box>
                        <Icon path={mdiFilterVariant} size={1} />
                        {filters.length > 0 && (
                            <Tag
                                position="absolute"
                                top={0}
                                borderRadius="full"
                                variant="solid"
                                colorScheme="green"
                                size="sm">
                                {filters.length}
                            </Tag>
                        )}
                    </Box>
                }
                variant="ghost"
                title="Filter by tags"
                isDisabled={isLoading}
            />
            <MenuList maxH="20rem" overflowY="auto">
                <Flex alignItems="center" justifyContent="center" pb={2}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => filter([])}>
                        Clear tags
                    </Button>
                </Flex>
                <Divider />
                <MenuOptionGroup
                    type="checkbox"
                    onChange={handleFilter}
                    value={filters}>
                    {tags.map((tag) => (
                        <MenuItemOption key={tag} value={tag}>
                            <TagChip tag={tag} />
                        </MenuItemOption>
                    ))}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const SortBtn = () => {
    const {
        actions,
        searchRequest: { sort },
        isLoading
    } = useCollectionGrid();
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
        actions.sort({
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
                isDisabled={isLoading}
            />
            <MenuList>
                <MenuOptionGroup
                    type="radio"
                    onChange={handleSort}
                    value={sortValue}>
                    <MenuItemOption value="-timestamp">
                        Newest first
                    </MenuItemOption>
                    <MenuItemOption value="+timestamp">
                        Oldest first
                    </MenuItemOption>
                    <MenuItemOption value="+name">Name (A-Z)</MenuItemOption>
                    <MenuItemOption value="-name">Name (Z-A)</MenuItemOption>
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const UploadCollectionBtn = () => {
    const {
        actions: { upload },
        isLoading,
        isUploading
    } = useCollectionGrid();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const name =
            files[0]?.webkitRelativePath.split("/")[0] || "New collection";
        upload(files, name);
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
                isDisabled={isLoading || isUploading}
            />
        </div>
    );
};

const UploadFilesBtn = () => {
    const {
        actions: { upload },
        isLoading,
        isUploading
    } = useCollectionGrid();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        upload(files);
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
                isDisabled={isLoading || isUploading}
                onClick={() => fileInputRef?.current?.click()}>
                Upload
            </Button>
        </div>
    );
};

const CreateCollectionBtn = () => {
    const { isLoading, isUploading } = useCollectionGrid();
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button
                onClick={onOpen}
                leftIcon={<AddIcon />}
                title="Create a new collection"
                isDisabled={isLoading || isUploading}>
                Create
            </Button>
            <CollectionModal isOpen={isOpen} onClose={onClose} mode="create" />
        </>
    );
};

const SearchBar = () => {
    const {
        actions: { search },
        searchRequest: { query }
    } = useCollectionGrid();

    return (
        <InputGroup>
            <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
            </InputLeftElement>
            <Input
                type="search"
                placeholder="Search..."
                value={query || ""}
                onChange={(e) => search(e.target.value)}
            />
        </InputGroup>
    );
};
