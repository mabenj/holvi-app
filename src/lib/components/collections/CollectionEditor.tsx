import {
    CollectionFields,
    createCollection,
    updateCollection
} from "@/lib/client/collections";
import { getErrorMessage } from "@/lib/common/utilities";
import EditorSurface from "@/lib/components/surfaces/EditorSurface";
import TagInput from "@/lib/components/tags/TagInput";
import { CollectionValidator } from "@/lib/validators/collection.validator";
import { Field, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const FORM_ID = "collection-editor";
const EMPTY_FIELDS: CollectionFields = { name: "", description: "", tags: [] };

interface CollectionEditorProps {
    open: boolean;
    onClose: () => void;
    /** The collection to edit; absent to create one */
    collection?: { id: string } & CollectionFields;
    /** Name to start a new collection with, e.g. the name of a dropped folder */
    initialName?: string;
    /** Files that will be uploaded into the new collection, e.g. dropped ones */
    fileCount?: number;
    /** After saving, with the saved collection's id; the editor stays open until the parent closes it */
    onSaved: (collectionId: string) => void | Promise<void>;
}

/** Creates a collection, or edits one's name, description and tags */
export default function CollectionEditor({
    open,
    onClose,
    collection,
    initialName = "",
    fileCount = 0,
    onSaved
}: CollectionEditorProps) {
    const {
        register,
        handleSubmit,
        control,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useForm<CollectionFields>({
        resolver: zodResolver(CollectionValidator)
    });
    const [saveError, setSaveError] = useState<string | null>(null);

    // Every opening starts from the collection as it is then; a refetch while
    // the editor is open (e.g. after an upload) must not wipe the user's edits
    const startingPoint = useRef<CollectionFields>(EMPTY_FIELDS);
    startingPoint.current = {
        name: collection?.name ?? initialName,
        description: collection?.description ?? "",
        tags: collection?.tags ?? []
    };
    useEffect(() => {
        if (!open) return;
        setSaveError(null);
        reset(startingPoint.current);
    }, [open, reset]);

    const save = async (fields: CollectionFields) => {
        setSaveError(null);
        try {
            const result = collection
                ? await updateCollection(collection.id, fields)
                : await createCollection(fields);
            if ("nameError" in result) {
                setError("name", { message: result.nameError });
                return;
            }
            await onSaved(result.id);
        } catch (error) {
            setSaveError(getErrorMessage(error));
        }
    };

    return (
        <EditorSurface
            open={open}
            onClose={onClose}
            title={collection ? "Edit collection" : "New collection"}
            submitLabel={collection ? "Save" : "Create"}
            formId={FORM_ID}
            submitting={isSubmitting}>
            <form id={FORM_ID} onSubmit={handleSubmit(save)} noValidate>
                <Stack gap="5">
                    {fileCount > 0 && (
                        <Text color="fg.muted" textStyle="sm">
                            {fileCount === 1
                                ? "1 file will be uploaded into it."
                                : `${fileCount} files will be uploaded into it.`}
                        </Text>
                    )}
                    <Field.Root invalid={!!errors.name} required>
                        <Field.Label>
                            Name <Field.RequiredIndicator />
                        </Field.Label>
                        <Input
                            autoComplete="off"
                            {...register("name")}
                        />
                        <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={!!errors.description}>
                        <Field.Label>Description</Field.Label>
                        <Textarea rows={4} {...register("description")} />
                        <Field.ErrorText>
                            {errors.description?.message}
                        </Field.ErrorText>
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
