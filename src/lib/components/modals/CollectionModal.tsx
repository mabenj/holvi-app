import { CollectionDto } from "@/lib/types/collection-dto";
import {
    Button,
    Flex,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    Heading,
    Input,
    Textarea,
    useDisclosure
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import {
    CollectionFormData,
    CollectionValidator
} from "../../validators/collection.validator";
import Dialog from "../ui/Dialog";
import TagInput from "../ui/TagInput";

interface CollectionModalProps {
    mode: "edit" | "create";
    trigger: React.ReactNode;
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
    mode,
    trigger,
    onSave,
    isSaving,
    initialCollection
}: CollectionModalProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();

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

    const handleClose = () => {
        onClose();
        setValue("name", initialCollection?.name || "");
        setValue("tags", initialCollection?.tags || []);
        setValue("description", initialCollection?.description);
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            onOpen={onOpen}
            trigger={trigger}
            title={
                <Heading size="lg" mb={8}>
                    {mode === "edit" ? "Edit collection" : "Create collection"}
                </Heading>
            }>
            <form id="create-collection-form" onSubmit={handleSubmit(onSubmit)}>
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
            <Flex
                w="100%"
                justifyContent="center"
                alignItems="center"
                mt={10}
                gap={3}>
                <Button variant="ghost" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="create-collection-form"
                    isLoading={isSaving}>
                    {mode === "edit" ? "Save" : "Create"}
                </Button>
            </Flex>
        </Dialog>
    );
}
