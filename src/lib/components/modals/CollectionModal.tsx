import { CollectionDto } from "@/lib/types/collection-dto";
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
    ModalOverlay,
    Textarea
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
    CollectionFormData,
    CollectionValidator
} from "../../validators/collection.validator";
import TagInput from "../ui/TagInput";

interface CollectionModalProps {
    isOpen: boolean;
    mode: "edit" | "create";
    onClose: () => void;
    onSave: (
        data: CollectionFormData,
        id?: string
    ) => Promise<
        | CollectionDto
        | {
              nameError: string;
          }
    >;
    isSaving: boolean;
    initialCollection?: CollectionDto;
}

export default function CollectionModal({
    isOpen,
    onClose,
    onSave,
    isSaving,
    mode,
    initialCollection
}: CollectionModalProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        setValue,
        control
    } = useForm<CollectionFormData>({
        defaultValues: {
            name: initialCollection?.name,
            tags: initialCollection?.tags || [],
            description: initialCollection?.description || ""
        },
        resolver: zodResolver(CollectionValidator)
    });

    const onSubmit = async (formData: CollectionFormData) => {
        const result = await onSave(formData, initialCollection?.id);
        if ("nameError" in result) {
            setError("name", {
                message: result.nameError
            });
            return;
        }
        onClose();
        setValue(
            "name",
            mode === "edit" ? result.name : initialCollection?.name || ""
        );
        setValue(
            "description",
            mode === "edit"
                ? result.description
                : initialCollection?.description
        );
        setValue(
            "tags",
            mode === "edit" ? result.tags : initialCollection?.tags || []
        );
    };

    const close = () => {
        onClose();
        setValue("name", initialCollection?.name || "");
        setValue("tags", initialCollection?.tags || []);
        setValue("description", initialCollection?.description);
    };

    return (
        <Modal isOpen={isOpen} onClose={close}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>
                    {mode === "edit" ? "Edit collection" : "Create collection"}
                </ModalHeader>
                <ModalCloseButton />

                <ModalBody>
                    <form
                        id="create-collection-form"
                        onSubmit={handleSubmit(onSubmit)}>
                        <Flex direction="column" gap={4}>
                            <FormControl isInvalid={!!errors.name}>
                                <FormLabel>Collection name</FormLabel>
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
                            <FormControl isInvalid={!!errors.description}>
                                <FormLabel>Description</FormLabel>
                                <Textarea
                                    placeholder="Description..."
                                    {...register("description")}
                                />
                                <FormErrorMessage>
                                    {errors.description?.message}
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
                    <Button variant="ghost" mr={3} onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="create-collection-form"
                        isLoading={isSaving}>
                        {mode === "edit" ? "Save" : "Create"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
