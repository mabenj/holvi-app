import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { useFileDragAndDrop } from "@/lib/hooks/useFileDragAndDrop";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { SearchIcon } from "@chakra-ui/icons";
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
} from "@chakra-ui/react";
import {
  mdiBackupRestore,
  mdiCheckboxBlankOffOutline,
  mdiCheckboxOutline,
  mdiDelete,
  mdiExport,
  mdiFilterVariant,
  mdiFolderUpload,
  mdiSort,
  mdiSquareEditOutline,
  mdiUpload,
} from "@mdi/js";
import Icon from "@mdi/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import CollectionFileModal from "../modals/CollectionFileModal";
import CollectionModal from "../modals/CollectionModal";
import AreYouSureDialog from "../ui/AreYouSureDialog";
import TagChip from "../ui/TagChip";
import { useCollection } from "@/lib/hooks/useCollection";
import { useCollections } from "@/lib/hooks/useCollections";

interface CollectionGridActionBarProps {
  collectionId: string;
}

export default function CollectionGridActionBar({
  collectionId,
}: CollectionGridActionBarProps) {
  const {
    flags: { isSelectModeOn },
  } = useCollectionGrid();

  const canFilter = collectionId === "root";
  const canUploadFiles = collectionId !== "root";
  const canCreateCollection = collectionId === "root";
  const canBackup = collectionId === "root";

  return (
    <>
      <Flex
        alignItems="center"
        direction={["column", "column", "row"]}
        w="100%"
        gap={2}
        px={2}
      >
        <Box flexGrow={1} w="100%">
          <SearchBar />
        </Box>
        <Flex alignItems="center" gap={2}>
          {isSelectModeOn && <EditItemBtn />}
          {isSelectModeOn && <DeleteItemsBtn />}
          <SelectItemsBtn />
          {canFilter && <FilterBtn />}
          <SortBtn />
          {canUploadFiles && <UploadFilesBtn />}
          {canBackup && <ExportCollectionsBtn />}
          {canCreateCollection && <CreateCollectionBtn />}
        </Flex>
      </Flex>
    </>
  );
}

const ExportCollectionsBtn = () => {
  const { backupCollections, isBackupLoading } = useCollections();

  return (
    <AreYouSureDialog
      header="Backup collections"
      confirmLabel="Backup"
      isConfirming={isBackupLoading}
      onConfirm={backupCollections}
      trigger={
        <IconButton
          variant="ghost"
          aria-label="Backup all collections"
          title="Backup all collections"
          icon={<Icon path={mdiBackupRestore} size={1} />}
        />
      }
    >
      Are you sure you want to backup all collections? This can take a while.
    </AreYouSureDialog>
  );
};

const FilterBtn = () => {
  const {
    tags,
    actions: { filterTags: filter },
    searchRequest: { tags: filters },
    flags: { isLoading },
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
                size="sm"
              >
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
          <Button variant="ghost" size="sm" onClick={() => filter([])}>
            Clear tags
          </Button>
        </Flex>
        <Divider />
        {tags.length === 0 && (
          <Flex
            alignItems="center"
            justifyContent="center"
            color="gray.500"
            p={2}
          >
            No tags exist
          </Flex>
        )}
        <MenuOptionGroup
          type="checkbox"
          onChange={handleFilter}
          value={filters}
        >
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
    flags: { isLoading },
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
      asc: sortField.startsWith("+"),
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
        <MenuOptionGroup type="radio" onChange={handleSort} value={sortValue}>
          <MenuItemOption value="-timestamp">Newest first</MenuItemOption>
          <MenuItemOption value="+timestamp">Oldest first</MenuItemOption>
          <MenuItemOption value="+name">Name (A-Z)</MenuItemOption>
          <MenuItemOption value="-name">Name (Z-A)</MenuItemOption>
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};

const UploadFilesBtn = () => {
  const {
    collectionId,
    actions: { upload },
    flags: { isLoading, isUploading },
  } = useCollectionGrid();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { droppedFiles } = useFileDragAndDrop(collectionId !== "root");

  useEffect(() => {
    if (!droppedFiles || droppedFiles.length === 0) {
      return;
    }
    upload(droppedFiles);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFiles]);

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
        onClick={() => fileInputRef?.current?.click()}
      >
        Upload
      </Button>
    </div>
  );
};

const CreateCollectionBtn = () => {
  const {
    collectionId,
    actions: { saveCollection },
    flags: { isSavingCollection, isLoading, isUploading },
  } = useCollectionGrid();

  return (
    <CollectionModal
      onSave={saveCollection}
      isSaving={isSavingCollection}
      mode="create"
      trigger={
        <Button
          leftIcon={<Icon path={mdiFolderUpload} size={1} />}
          title="Create a new collection"
          isDisabled={isLoading || isUploading}
        >
          Create
        </Button>
      }
      fileDragAndDrop={collectionId === "root"}
    />
  );
};

const SearchBar = () => {
  const {
    actions: { search },
    searchRequest: { query },
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

const SelectItemsBtn = () => {
  const {
    flags: { isSelectModeOn },
    actions: { toggleSelectMode },
  } = useCollectionGrid();

  return (
    <IconButton
      variant="ghost"
      aria-label={isSelectModeOn ? "Unselect all" : "Select items"}
      title={isSelectModeOn ? "Unselect all" : "Select items"}
      icon={
        <Icon
          path={
            isSelectModeOn ? mdiCheckboxBlankOffOutline : mdiCheckboxOutline
          }
          size={1}
        />
      }
      onClick={toggleSelectMode}
    />
  );
};

const DeleteItemsBtn = () => {
  const {
    selection,
    flags: { isDeletingSelection },
    actions: { deleteSelected },
  } = useCollectionGrid();

  const selectionCount = Object.keys(selection).filter(
    (id) => !!selection[id]
  ).length;

  const handleDelete = async () => {
    await deleteSelected();
  };

  return (
    <>
      <AreYouSureDialog
        confirmLabel="Delete"
        header={
          selectionCount === 1
            ? "Delete item"
            : `Delete ${selectionCount} items`
        }
        isConfirming={isDeletingSelection}
        onConfirm={handleDelete}
        trigger={
          <IconButton
            variant="ghost"
            aria-label="Delete selected"
            title="Delete selected"
            icon={<Icon path={mdiDelete} size={1} />}
            isDisabled={selectionCount === 0}
          />
        }
      >
        Are you sure? You cannot undo this afterwards.
      </AreYouSureDialog>
    </>
  );
};

const EditItemBtn = () => {
  const [selectionCount, setSelectionCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<CollectionGridItem | null>(
    null
  );
  const {
    selection,
    items,
    flags: { isSavingCollection, isSavingFile },
    actions: { saveCollection, editFile },
  } = useCollectionGrid();

  const collectionSelected =
    !!selectedItem && selectedItem.type === "collection";
  const fileSelected = !!selectedItem && selectedItem.type !== "collection";

  useEffect(() => {
    const numOfSelected = Object.keys(selection).filter(
      (id) => !!selection[id]
    ).length;
    setSelectionCount(numOfSelected);

    if (numOfSelected !== 1) {
      setSelectedItem(null);
      return;
    }

    const selectedId = Object.keys(selection).find((id) => !!selection[id]);
    const item =
      items.collections.find((collection) => collection.id === selectedId) ||
      items.files.find((file) => file.id === selectedId);

    setSelectedItem(item || null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const triggerBtn = (
    <IconButton
      variant="ghost"
      aria-label="Edit selected"
      title="Edit selected"
      icon={<Icon path={mdiSquareEditOutline} size={1} />}
      isDisabled={selectionCount !== 1}
    />
  );

  if (collectionSelected) {
    return (
      <CollectionModal
        onSave={saveCollection}
        isSaving={isSavingCollection}
        mode="edit"
        initialCollection={selectedItem}
        trigger={triggerBtn}
      />
    );
  }

  if (fileSelected) {
    return (
      <CollectionFileModal
        onSave={editFile}
        isSaving={isSavingFile}
        initialFile={selectedItem}
        trigger={triggerBtn}
      />
    );
  }

  return null;
};
