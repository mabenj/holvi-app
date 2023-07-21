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
import { Controller, useForm } from "react-hook-form";
import { ApiData } from "../../common/api-route";
import { getErrorMessage } from "../../common/utilities";
import { useHttp } from "../../hooks/useHttp";
import { CollectionFileDto } from "../../interfaces/collection-file-dto";
import {
    UpdateCollectionFileData,
    UpdateCollectionFileValidator
} from "../../validators/update-collection-file-validator";
import TagInput from "../TagInput";

interface CollectionFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (collection: CollectionFileDto) => void;
    initialFile: Partial<CollectionFileDto>;
}

export default function CollectionFileModal({
    isOpen,
    onClose,
    onSave,
    initialFile
}: CollectionFileModalProps) {
    const http = useHttp();
    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        control
    } = useForm<UpdateCollectionFileData>({
        defaultValues: {
            id: initialFile.id,
            name: initialFile.name,
            tags: initialFile.tags || []
        },
        resolver: zodResolver(UpdateCollectionFileValidator)
    });
    const toast = useToast();

    const onSubmit = async (formData: UpdateCollectionFileData) => {
        const { data, error } = await http.post<
            ApiData<{ file?: CollectionFileDto }>
        >(`/api/collections/${initialFile.collectionId}/files`, formData);
        if (error || !data?.file) {
            toast({
                description: `Could not edit file: ${getErrorMessage(error)}`,
                status: "error"
            });
            return;
        }
        onSave(data.file);
        onClose();
        toast({
            description: `Collection modified`,
            status: "success"
        });
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
                        isLoading={http.isLoading}>
                        Save
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
