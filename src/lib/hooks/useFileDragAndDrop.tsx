import { useEffect, useState } from "react";

export function useFileDragAndDrop(enabled: boolean) {
    const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
    const [droppedFolderName, setDroppedFolderName] = useState("");

    useEffect(() => {
        if (!enabled || !("webkitGetAsEntry" in DataTransferItem.prototype)) {
            return;
        }

        window.addEventListener("drop", handleDrop);
        window.addEventListener("dragenter", handleDrag);
        window.addEventListener("dragover", handleDrag);

        return () => {
            window.removeEventListener("drop", handleDrop);
            window.removeEventListener("dragenter", handleDrag);
            window.removeEventListener("dragover", handleDrag);
        };
    }, [enabled]);

    const handleDrop = async (e: DragEvent) => {
        if (!e.dataTransfer) {
            return;
        }
        e.dataTransfer.dropEffect = "copy";
        e.preventDefault();

        const entries = Array.from(e.dataTransfer.items)
            .map((item) => item.webkitGetAsEntry())
            .filter((item): item is FileSystemEntry => !!item);
        const files = await Promise.all(
            entries.map((item) => traverseFileTree(item))
        );

        setDroppedFiles(files.flat());
        setDroppedFolderName(
            entries.find((entry) => isDirectory(entry))?.name || ""
        );
    };

    const handleDrag = (e: DragEvent) => {
        e.preventDefault();
    };

    return { droppedFiles, droppedFolderName };
}

// https://stackoverflow.com/a/11410455
async function traverseFileTree(
    item: FileSystemEntry,
    path: string = ""
): Promise<File[]> {
    const result: File[] = [];
    if (isFile(item)) {
        const file = await new Promise<File>((resolve, reject) =>
            item.file(resolve, reject)
        );
        result.push(file);
    } else if (isDirectory(item)) {
        const reader = item.createReader();

        let entries = await getEntries(reader);
        while (entries.length > 0) {
            const files = await Promise.all(
                entries.map((entry) =>
                    traverseFileTree(entry, path + item.name + "/")
                )
            );
            result.push(...files.flat());

            entries = await getEntries(reader);
        }
    }
    return result;
}

function getEntries(reader: FileSystemDirectoryReader) {
    return new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
    );
}

function isFile(item: FileSystemEntry): item is FileSystemFileEntry {
    return item.isFile;
}

function isDirectory(item: FileSystemEntry): item is FileSystemDirectoryEntry {
    return item.isDirectory;
}
