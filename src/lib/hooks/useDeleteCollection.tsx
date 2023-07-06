import { useState } from "react";

export function useDeleteCollection() {
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteCollection = async (id: string) => {
        setIsDeleting(true);
        const response = await fetch(`/api/collections/${id}`, {
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
