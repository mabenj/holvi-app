import { useState } from "react";

export function useDeleteFile(collectionId: string) {
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteFile = async (id: string) => {
        setIsDeleting(true);
        const response = await fetch(
            `/api/collections/${collectionId}/files/${id}`,
            {
                method: "DELETE"
            }
        );
        setIsDeleting(false);
        const { status, error } = await response.json();
        if (status === "error" || error) {
            return Promise.reject(error);
        }
        return Promise.resolve();
    };

    return { deleteFile, isDeleting };
}
