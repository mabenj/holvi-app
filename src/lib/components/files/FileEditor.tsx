import { FileFields, updateFile } from "@/lib/client/collections";
import { getErrorMessage } from "@/lib/common/utilities";
import EditorSurface from "@/lib/components/surfaces/EditorSurface";
import TagInput from "@/lib/components/tags/TagInput";
import { CollectionFileValidator } from "@/lib/validators/collection-file.validator";
import { Field, Input, Stack, Text } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const FORM_ID = "file-editor";
const FileFieldsValidator = CollectionFileValidator.omit({ id: true });

interface FileEditorProps {
    open: boolean;
    onClose: () => void;
    /** The file to edit */
    file: { id: string; collectionId: string } & FileFields;
    /** After saving, with what was saved; the editor stays open until the parent closes it */
    onSaved: (fields: FileFields) => void | Promise<void>;
}

/** Edits a file's name and tags */
export default function FileEditor({
    open,
    onClose,
    file,
    onSaved
}: FileEditorProps) {
    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<FileFields>({ resolver: zodResolver(FileFieldsValidator) });
    const [saveError, setSaveError] = useState<string | null>(null);

    // Every opening starts from the file as it is then
    const startingPoint = useRef<FileFields>(file);
    startingPoint.current = { name: file.name, tags: file.tags };
    useEffect(() => {
        if (!open) return;
        setSaveError(null);
        reset(startingPoint.current);
    }, [open, reset]);

    const save = async (fields: FileFields) => {
        setSaveError(null);
        try {
            await updateFile(file.collectionId, file.id, fields);
            await onSaved(fields);
        } catch (error) {
            setSaveError(getErrorMessage(error));
        }
    };

    return (
        <EditorSurface
            open={open}
            onClose={onClose}
            title="Edit file"
            submitLabel="Save"
            formId={FORM_ID}
            submitting={isSubmitting}>
            <form id={FORM_ID} onSubmit={handleSubmit(save)} noValidate>
                <Stack gap="5">
                    <Field.Root invalid={!!errors.name} required>
                        <Field.Label>
                            Name <Field.RequiredIndicator />
                        </Field.Label>
                        <Input autoComplete="off" {...register("name")} />
                        <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={!!errors.tags}>
                        <Field.Label>Tags</Field.Label>
                        <Controller
                            control={control}
                            name="tags"
                            render={({ field }) => (
                                <TagInput
                                    value={field.value ?? []}
                                    onChange={field.onChange}
                                    invalid={!!errors.tags}
                                />
                            )}
                        />
                        <Field.ErrorText>{errors.tags?.message}</Field.ErrorText>
                    </Field.Root>
                    {saveError && (
                        <Text color="fg.error" textStyle="sm" role="alert">
                            {saveError}
                        </Text>
                    )}
                </Stack>
            </form>
        </EditorSurface>
    );
}
