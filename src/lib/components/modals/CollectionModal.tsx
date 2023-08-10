import { CollectionDto } from "@/lib/types/collection-dto";
import {
    Box,
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
import { mdiFolderUpload, mdiUpload } from "@mdi/js";
import Icon from "@mdi/react";
import React, { ChangeEvent, useRef, useState } from "react";
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
        id?: string,
        files?: File[]
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
    const [files, setFiles] = useState<File[]>([]);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        getValues,
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
        const result = await onSave(formData, initialCollection?.id, files);
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

    const onFiles = (files: File[], folderName?: string) => {
        setFiles(files);
        const { name } = getValues();
        if (!name && folderName) {
            setValue("name", folderName);
        }
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            onOpen={onOpen}
            trigger={trigger}
            title={
                <Heading size="lg" mb={8} textAlign="center">
                    {mode === "edit" ? "Edit collection" : "Create collection"}
                </Heading>
            }>
            {mode === "create" && <UploadButtons onFiles={onFiles} />}
            <form id="create-collection-form" onSubmit={handleSubmit(onSubmit)}>
                <Flex direction="column" gap={5}>
                    <FormControl isInvalid={!!errors.name}>
                        <FormLabel>Collection name</FormLabel>
                        <Input
                            type="text"
                            isRequired
                            placeholder="Name"
                            {...register("name")}
                        />
                        <FormErrorMessage>
                            {errors.name?.message}
                        </FormErrorMessage>
                    </FormControl>
                    <FormControl isInvalid={!!errors.description}>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                            placeholder="Description"
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

const UploadButtons = ({
    onFiles
}: {
    onFiles: (files: File[], folderName?: string) => void;
}) => {
    const [currentFiles, setCurrentFiles] = useState<File[]>([]);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFilesSelected = (
        e: ChangeEvent<HTMLInputElement>,
        isFolder?: boolean
    ) => {
        const files = Array.from(e.target.files || []);
        const folderName = isFolder
            ? files[0]?.webkitRelativePath.split("/")[0]
            : undefined;
        onFiles(files, folderName);
        setCurrentFiles(files);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        if (folderInputRef.current) {
            folderInputRef.current.value = "";
        }
    };

    const handleClearFiles = () => {
        onFiles([]);
        setCurrentFiles([]);
    };

    return (
        <>
            {currentFiles.length === 0 && (
                <Flex
                    justifyContent="center"
                    alignItems="center"
                    gap={5}
                    pb={8}>
                    <Button
                        variant="outline"
                        leftIcon={<Icon path={mdiFolderUpload} size={0.7} />}
                        onClick={() => folderInputRef?.current?.click()}>
                        Select folder
                    </Button>
                    <Box color="gray.500">or</Box>
                    <Button
                        variant="outline"
                        leftIcon={<Icon path={mdiUpload} size={0.7} />}
                        onClick={() => fileInputRef?.current?.click()}>
                        Select files
                    </Button>
                </Flex>
            )}

            {currentFiles.length > 0 && (
                <Flex
                    justifyContent="center"
                    alignItems="center"
                    gap={2}
                    pb={8}>
                    <Box color="gray.500">
                        {currentFiles.length === 1
                            ? `1 file selected`
                            : `${currentFiles.length} files selected`}
                    </Box>
                    <Button
                        size="sm"
                        variant="ghost"
                        title="Clear files"
                        onClick={handleClearFiles}>
                        Clear
                    </Button>
                </Flex>
            )}

            <input
                ref={folderInputRef}
                type="file"
                style={{ display: "none" }}
                {...{
                    webkitdirectory: "true",
                    mozdirectory: "true",
                    directory: "true"
                }}
                onChange={(e) => handleFilesSelected(e, true)}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                multiple
                onChange={handleFilesSelected}
            />
        </>
    );
};
