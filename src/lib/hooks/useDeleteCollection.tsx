import { useState } from "react";

export function useDeleteCollection() {
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteCollection = async (id: number) => {
        setIsDeleting(true);
        const response = await fetch(`/api/collection/delete/${id}`, {
            method: "DELETE"
        });
        setIsDeleting(false);
        const { status, error } = await response.json();
        if (status === "error" || error) {
            return Promise.reject(error);
        }
        return Promise.resolve();
    };

    return { deleteCollection, isDeleting };
}
