import {
    Button,
    Flex,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    Heading,
    Input,
    useDisclosure
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { CollectionFileDto } from "../../types/collection-file-dto";
import {
    CollectionFileFormData,
    CollectionFileValidator
} from "../../validators/collection-file.validator";
import Dialog from "../ui/Dialog";
import TagInput from "../ui/TagInput";

interface CollectionFileModalProps {
    trigger: React.ReactNode;
    onSave: (
        data: CollectionFileFormData,
        id: string
    ) => Promise<CollectionFileDto>;
    isSaving: boolean;
    initialFile: CollectionFileDto;
}

export default function CollectionFileModal({
    trigger,
    onSave,
    isSaving,
    initialFile
}: CollectionFileModalProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();

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

    const onSubmit = async (formData: CollectionFileFormData) => {
        if (!initialFile.collectionId) {
            return;
        }
        const edited = await onSave(formData, initialFile.collectionId);
        onClose();
        setValue("name", edited.name);
        setValue("tags", edited.tags);
    };

    const handleCancel = () => {
        onClose();
        setValue("name", initialFile.name || "");
        setValue("tags", initialFile.tags || []);
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            onOpen={onOpen}
            trigger={trigger}
            title={
                <Heading size="lg" mb={8}>
                    Edit file
                </Heading>
            }>
            <form id="collection-file-form" onSubmit={handleSubmit(onSubmit)}>
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

            <Flex
                w="100%"
                justifyContent="center"
                alignItems="center"
                mt={10}
                gap={3}>
                <Button variant="ghost" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="collection-file-form"
                    isLoading={isSaving}>
                    Save
                </Button>
            </Flex>
        </Dialog>
    );
}
