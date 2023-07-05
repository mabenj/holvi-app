import { useState } from "react";
import { useCollections } from "../context/CollectionsContext";

export function useDeleteCollection() {
    const [isDeleting, setIsDeleting] = useState(false);
    const { setCollections } = useCollections();

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
        setCollections((prev) => prev.filter((c) => c.id !== id));
        return Promise.resolve();
    };

    return { deleteCollection, isDeleting };
}
