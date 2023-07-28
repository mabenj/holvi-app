import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import {
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
    ModalOverlay
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CollectionFileDto } from "../../types/collection-file-dto";
import {
    CollectionFileFormData,
    CollectionFileValidator
} from "../../validators/collection-file.validator";
import TagInput from "../ui/TagInput";

interface CollectionFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialFile: Partial<CollectionFileDto>;
}

export default function CollectionFileModal({
    isOpen,
    onClose,
    initialFile
}: CollectionFileModalProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        control
    } = useForm<CollectionFileFormData>({
        defaultValues: {
            id: initialFile.id,
            name: initialFile.name,
            tags: initialFile.tags || []
        },
        resolver: zodResolver(CollectionFileValidator)
    });

    const [isSaving, setIsSaving] = useState(false);
    const {
        actions: { editFile }
    } = useCollectionGrid();

    const onSubmit = async (formData: CollectionFileFormData) => {
        if (!initialFile.collectionId) {
            return;
        }
        setIsSaving(true);
        await editFile(formData, initialFile.collectionId).finally(() =>
            setIsSaving(false)
        );
        onClose();
        setValue("name", formData.name);
        setValue("tags", formData.tags);
    };

    const handleCancel = () => {
        onClose();
        setValue("name", initialFile.name || "");
        setValue("tags", initialFile.tags || []);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleCancel}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Edit file</ModalHeader>
                <ModalCloseButton />

                <ModalBody>
                    <form
                        id="collection-file-form"
                        onSubmit={handleSubmit(onSubmit)}>
                        <Flex direction="column" gap={4}>
                            <Input {...register("id")} hidden />
                            <FormControl isInvalid={!!errors.name}>
                                <FormLabel>File name</FormLabel>
                                <Input
                                    type="text"
                                    isRequired
                                    placeholder="Name..."
                                    {...register("name")}
                                />
                                <FormErrorMessage>
                                    {errors.name?.message}
                                </FormErrorMessage>
                            </FormControl>
                            <FormControl isInvalid={!!errors.tags}>
                                <FormLabel>Tags</FormLabel>
                                <Controller
                                    control={control}
                                    name="tags"
                                    defaultValue={[]}
                                    render={({
                                        field: { onChange, onBlur, value }
                                    }) => (
                                        <TagInput
                                            value={value}
                                            onChange={onChange}
                                            onBlur={onBlur}
                                        />
                                    )}
                                />

                                <FormErrorMessage>
                                    {errors.tags?.message}
                                </FormErrorMessage>
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
                        form="collection-file-form"
                        isLoading={isSaving}>
                        Save
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
