import { caseInsensitiveSorter } from "@/lib/common/utilities";
import { useCollections } from "@/lib/context/CollectionsContext";
import useDebounce from "@/lib/hooks/useDebounce";
import { SearchIcon } from "@chakra-ui/icons";
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
    useToast
} from "@chakra-ui/react";
import { mdiFilterVariant, mdiFolderUpload, mdiSort, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useRef, useState } from "react";

interface CollectionGridActionBarProps {
    rootCollectionId?: number;
}

export default function CollectionGridActionBar({
    rootCollectionId
}: CollectionGridActionBarProps) {
    const [_, setCollections] = useCollections();
    const toast = useToast();

    const listAllFiles = () => {
        alert("List all files"); //TODO
    };

    const filter = (filters: Record<string, boolean>) => {
        alert("Filter: " + JSON.stringify(filters, null, 2)); //TODO
    };

    const sort = (field: string, asc: boolean) => {
        switch (field) {
            case "name": {
                setCollections((prev) => [
                    ...prev.sort(caseInsensitiveSorter("name", asc))
                ]);
                break;
            }
            case "date": {
                setCollections((prev) => [
                    ...prev.sort(caseInsensitiveSorter("createdAt", asc))
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

    const search = (query: string) => {
        alert("Search: " + query); //TODO
    };

    const upload = (files: FileList | null) => {
        if (!files) {
            return;
        }
        alert(
            "Upload: " +
                JSON.stringify(
                    Array.from(files).map((file) => file.name),
                    null,
                    2
                )
        ); //TODO
    };

    return (
        <Flex alignItems="center" gap={2}>
            <Box flexGrow={1}>
                <SearchBar onSearch={search} />
            </Box>
            {rootCollectionId && <FilterBtn onFilter={filter} />}
            <SortBtn onSort={sort} />
            <ListAllFilesBtn onClick={listAllFiles} />
            {rootCollectionId ? (
                <UploadFilesBtn onUpload={upload} />
            ) : (
                <UploadCollectionBtn onUpload={upload} />
            )}
        </Flex>
    );
}

const ListAllFilesBtn = ({ onClick }: { onClick: () => void }) => {
    return (
        <Button variant="ghost" onClick={onClick}>
            List all files
        </Button>
    );
};

const FilterBtn = ({
    onFilter
}: {
    onFilter: (filters: Record<string, boolean>) => void;
}) => {
    const [filters, setFilters] = useState<string[]>(["collections", "files"]);

    const handleFilter = (e: string | string[]) => {
        const filters = Array.isArray(e) ? e : [e];
        setFilters(filters);
        onFilter({
            collections: filters.includes("collections"),
            files: filters.includes("files")
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
                    <MenuItemOption value="files">Files</MenuItemOption>
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const SortBtn = ({
    onSort
}: {
    onSort: (field: string, asc: boolean) => void;
}) => {
    const [sortField, setSortField] = useState("");

    const handleSort = (e: string | string[]) => {
        const field = Array.isArray(e) ? e[0] : e;
        setSortField(field);
        onSort(field.substring(1), field.startsWith("+"));
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
                    <MenuItemOption value="-date">Newest first</MenuItemOption>
                    <MenuItemOption value="+date">Oldest first</MenuItemOption>
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

const UploadCollectionBtn = ({
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
                style={{ display: "none" }}
                {...{
                    webkitdirectory: "true",
                    mozdirectory: "true",
                    directory: "true"
                }}
                onChange={(e) => onUpload(e.target.files)}
            />
            <Button
                onClick={() => fileInputRef?.current?.click()}
                leftIcon={<Icon path={mdiFolderUpload} size={1} />}>
                Upload collection
            </Button>
        </div>
    );
};

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
            />
            <Button
                onClick={() => fileInputRef?.current?.click()}
                leftIcon={<Icon path={mdiUpload} size={1} />}>
                Upload files
            </Button>
        </div>
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
