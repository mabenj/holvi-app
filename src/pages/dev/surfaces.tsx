import AppShell from "@/lib/components/app-shell/AppShell";
import ConfirmationSurface from "@/lib/components/surfaces/ConfirmationSurface";
import EditorSurface from "@/lib/components/surfaces/EditorSurface";
import { Button, Field, Input, Stack, Textarea } from "@chakra-ui/react";
import { GetServerSideProps } from "next";
import { FormEvent, useState } from "react";

// A preview of the shared surfaces until real editors and confirmations use them.
// Development only: production serves a 404.
export const getServerSideProps: GetServerSideProps = async () =>
    process.env.NODE_ENV === "development" ? { props: {} } : { notFound: true };

export default function SurfacesPreview() {
    const [editorOpen, setEditorOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        setEditorOpen(false);
    };

    return (
        <AppShell title="Surfaces">
            <Stack gap="3" px="4" py="4" maxW="sm">
                <Button onClick={() => setEditorOpen(true)}>Open editor</Button>
                <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                    Open confirmation
                </Button>
            </Stack>
            <EditorSurface
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                title="Edit collection"
                submitLabel="Save"
                formId="preview-editor">
                <form id="preview-editor" onSubmit={onSubmit}>
                    <Stack gap="4">
                        <Field.Root>
                            <Field.Label>Name</Field.Label>
                            <Input defaultValue="Summer 2024" />
                        </Field.Root>
                        <Field.Root>
                            <Field.Label>Description</Field.Label>
                            <Textarea rows={4} />
                        </Field.Root>
                    </Stack>
                </form>
            </EditorSurface>
            <ConfirmationSurface
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Delete collection?"
                description="Summer 2024 and its 42 files will be deleted."
                confirmLabel="Delete"
                onConfirm={() => setConfirmOpen(false)}
                destructive
            />
        </AppShell>
    );
}
