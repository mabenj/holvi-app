import { useEffect, useRef, useState } from "react";

/** What was dropped: every file, including those inside dropped folders */
export interface DroppedFiles {
    files: File[];
    /** Name of the first dropped folder, e.g. to name a new collection after it */
    folderName: string | null;
}

/**
 * Lets the user drop files and folders anywhere on the window (a desktop
 * convenience). Tells whether files are being dragged over it, so the screen
 * can say what dropping will do.
 */
export function useFileDrop(
    onDrop: (dropped: DroppedFiles) => void,
    enabled = true
) {
    const [dragging, setDragging] = useState(false);
    const onDropRef = useRef(onDrop);
    const enabledRef = useRef(enabled);
    useEffect(() => {
        onDropRef.current = onDrop;
        enabledRef.current = enabled;
        if (!enabled) setDragging(false);
    }, [onDrop, enabled]);

    // Files dropped while dropping is off are still caught, so the browser
    // never opens them in place of the app
    useEffect(() => {
        // dragenter and dragleave fire for every element crossed; count them to know when the drag leaves the window
        let depth = 0;
        const carriesFiles = (event: DragEvent) =>
            !!event.dataTransfer?.types.includes("Files");

        const onDragEnter = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault();
            depth++;
            if (enabledRef.current) setDragging(true);
        };
        const onDragOver = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault();
            event.dataTransfer!.dropEffect = enabledRef.current ? "copy" : "none";
        };
        const onDragLeave = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) setDragging(false);
        };
        const onDropEvent = (event: DragEvent) => {
            if (!carriesFiles(event)) return;
            event.preventDefault();
            depth = 0;
            setDragging(false);
            if (!enabledRef.current) return;
            // The entries must be taken before the event handler returns
            const entries = Array.from(event.dataTransfer!.items)
                .map((item) => item.webkitGetAsEntry?.() ?? null)
                .filter((entry): entry is FileSystemEntry => !!entry);
            const plainFiles = Array.from(event.dataTransfer!.files);
            void readEntries(entries, plainFiles).then((dropped) => {
                if (dropped.files.length > 0) onDropRef.current(dropped);
            });
        };

        window.addEventListener("dragenter", onDragEnter);
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("dragleave", onDragLeave);
        window.addEventListener("drop", onDropEvent);
        return () => {
            window.removeEventListener("dragenter", onDragEnter);
            window.removeEventListener("dragover", onDragOver);
            window.removeEventListener("dragleave", onDragLeave);
            window.removeEventListener("drop", onDropEvent);
        };
    }, []);

    return { dragging };
}

async function readEntries(
    entries: FileSystemEntry[],
    plainFiles: File[]
): Promise<DroppedFiles> {
    // Without the entries API, only plain files can be read
    if (entries.length === 0) return { files: plainFiles, folderName: null };
    const files = await Promise.all(entries.map(filesIn));
    return {
        files: files.flat(),
        folderName: entries.find((entry) => entry.isDirectory)?.name ?? null
    };
}

/** The file, or every file inside the folder and its subfolders */
async function filesIn(entry: FileSystemEntry): Promise<File[]> {
    if (isFile(entry)) {
        return [
            await new Promise<File>((resolve, reject) =>
                entry.file(resolve, reject)
            )
        ];
    }
    if (isDirectory(entry)) {
        const reader = entry.createReader();
        const files: File[] = [];
        // A reader returns a folder's entries in batches until one comes back empty
        for (;;) {
            const batch = await new Promise<FileSystemEntry[]>(
                (resolve, reject) => reader.readEntries(resolve, reject)
            );
            if (batch.length === 0) break;
            const nested = await Promise.all(batch.map(filesIn));
            files.push(...nested.flat());
        }
        return files;
    }
    return [];
}

function isFile(entry: FileSystemEntry): entry is FileSystemFileEntry {
    return entry.isFile;
}

function isDirectory(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
    return entry.isDirectory;
}
