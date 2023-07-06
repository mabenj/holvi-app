import { useCollectionModal } from "@/lib/hooks/useCollectionModal";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import {
    Box,
    Button,
    Flex,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Tag,
    TagCloseButton,
    TagLabel,
    useToast
} from "@chakra-ui/react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { getErrorMessage } from "../common/utilities";

interface CollectionModalProps {
    isOpen: boolean;
    mode: "edit" | "create";
    onClose: () => void;
    onSave: (collection: CollectionDto) => void;
    initialCollection?: Partial<CollectionDto>;
}

export default function CollectionModal({
    isOpen,
    onClose,
    onSave,
    mode,
    initialCollection
}: CollectionModalProps) {
    const {
        name,
        setName,
        setTags,
        nameError,
        tags,
        isLoading,
        saveCollection
    } = useCollectionModal(initialCollection);
    const toast = useToast();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const collection = await saveCollection();
            onSave(collection);
            onClose();
            toast({
                description: `Collection ${
                    mode === "edit" ? "modified" : "created"
                }`,
                status: "success"
            });
        } catch (error) {
            error &&
                toast({
                    description: `Could not ${
                        mode === "edit" ? "edit" : "create"
                    } collection: ${getErrorMessage(error)}`,
                    status: "error"
                });
        }
    };

    const handleCancel = () => {
        onClose();
        setName(initialCollection?.name || "");
        setTags([...(initialCollection?.tags || [])]);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCancel}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>
                    {mode === "edit" ? "Edit collection" : "Create collection"}
                </ModalHeader>
                <ModalCloseButton />

                <ModalBody>
                    <form id="create-collection-form" onSubmit={handleSubmit}>
                        <Flex direction="column" gap={4}>
                            <FormControl isInvalid={!!nameError}>
                                <FormLabel>Collection name</FormLabel>
                                <Input
                                    type="text"
                                    isRequired
                                    placeholder="Name..."
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <FormErrorMessage>{nameError}</FormErrorMessage>
                            </FormControl>
                            <FormControl>
                                <FormLabel>Tags</FormLabel>
                                <TagInput value={tags} onChange={setTags} />
                                <FormHelperText>
                                    Confirm tags with Enter, Tab, or comma keys
                                </FormHelperText>
                            </FormControl>
                        </Flex>
                    </form>
                </ModalBody>

                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-collection-form"
                        isLoading={isLoading}>
                        {mode === "edit" ? "Save" : "Create"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

const TagInput = ({
    value,
    onChange
}: {
    value: string[];
    onChange: (value: string[]) => void;
}) => {
    const [inputValue, setInputValue] = useState("");

    const addTag = (tag: string) => {
        setInputValue("");
        tag = tag.trim();
        if (value.includes(tag.toLowerCase())) {
            return;
        }
        onChange([...value, tag]);
    };

    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "Enter": {
                if (!inputValue) {
                    // submit
                    break;
                }
                // fall through
            }
            case "Tab":
            case ",": {
                e.preventDefault();
                addTag(inputValue);
                break;
            }
            default:
            // nothing
        }
    };

    const removeTag = (index: number) => {
        value.splice(index, 1);
        onChange([...value]);
    };

    return (
        <Flex flexWrap="wrap" p={2} rounded="md" border="1px solid gray">
            {value.map((value, i) => (
                <Tag key={value} borderRadius="full" m={1}>
                    <TagLabel>{value}</TagLabel>
                    <TagCloseButton onClick={() => removeTag(i)} />
                </Tag>
            ))}
            <Box minW="1rem" flexGrow="1">
                <Input
                    variant="unstyled"
                    placeholder="Enter tags..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    m={1}
                />
            </Box>
        </Flex>
    );
};
