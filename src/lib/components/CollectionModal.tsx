import { CollectionDto } from "@/lib/interfaces/collection-dto";
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
    useToast
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { getErrorMessage } from "../common/utilities";
import {
    CreateCollectionFormData,
    CreateCollectionValidator
} from "../validators/create-collection-validator";
import TagInput from "./TagInput";

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        setValue,
        control
    } = useForm<CreateCollectionFormData>({
        defaultValues: {
            name: initialCollection?.name,
            tags: initialCollection?.tags || []
        },
        resolver: zodResolver(CreateCollectionValidator)
    });
    const toast = useToast();

    const onSubmit = async (formData: CreateCollectionFormData) => {
        const method = mode === "create" ? "POST" : "PUT";
        const body = JSON.stringify(
            mode === "create"
                ? formData
                : { id: initialCollection?.id!, ...formData }
        );
        setIsSubmitting(true);
        const data = await fetch("/api/collections", {
            method,
            body
        })
            .then((res) => res.json())
            .finally(() => setIsSubmitting(false));

        if (data.nameError) {
            setError("name", data.nameError);
        }
        if (data.error) {
            toast({
                description: `Could not ${
                    mode === "edit" ? "edit" : "create"
                } collection: ${getErrorMessage(data.error)}`,
                status: "error"
            });
            return;
        }
        onSave(data.collection);
        onClose();
        toast({
            description: `Collection ${
                mode === "edit" ? "modified" : "created"
            }`,
            status: "success"
        });
    };

    const handleCancel = () => {
        onClose();
        setValue("name", initialCollection?.name || "");
        setValue("tags", initialCollection?.tags || []);
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
                        form="create-collection-form"
                        isLoading={isSubmitting}>
                        {mode === "edit" ? "Save" : "Create"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
