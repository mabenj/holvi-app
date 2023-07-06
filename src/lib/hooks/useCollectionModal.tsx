import { useState } from "react";
import { CollectionDto } from "../interfaces/collection-dto";

export function useCollectionModal(initialCollection?: Partial<CollectionDto>) {
    const [name, setName] = useState(initialCollection?.name || "");
    const [nameError, setNameError] = useState("");
    const [tags, setTags] = useState<string[]>(initialCollection?.tags || []);
    const [isLoading, setIsLoading] = useState(false);

    const isNew = !initialCollection;

    const saveCollection = async () => {
        if (!name) {
            setNameError("Invalid collection name");
            Promise.reject();
        }

        setIsLoading(true);
        let response: Response;
        if (isNew) {
            response = await fetch("/api/collections", {
                method: "POST",
                body: JSON.stringify({ name, tags })
            });
        } else {
            response = await fetch("/api/collections", {
                method: "PUT",
                body: JSON.stringify({ id: initialCollection.id, name, tags })
            });
        }
        const data = await response.json();
        setNameError(data.error || "");
        setIsLoading(false);

        if (data.status === "error") {
            return Promise.reject();
        }

        if (isNew) {
            setName("");
            setNameError("");
        }

        const collection: CollectionDto = {
            id: data.collection.id,
            name: data.collection.name,
            tags: data.collection.tags,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
        
        return Promise.resolve(collection);
    };

    const handleNameChange = (name: string) => {
        setNameError("");
        setName(name);
    };

    const handleTagChange = (tags: string[]) => {
        setTags(Array.from(new Set(tags.filter((t) => !!t.trim()))));
    };

    return {
        name,
        setName: handleNameChange,
        setTags: handleTagChange,
        nameError,
        tags,
        isLoading,
        saveCollection
    };
}
