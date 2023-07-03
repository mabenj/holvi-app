import { useState } from "react";
import { useCollections } from "../context/CollectionsContext";
import { Collection } from "../interfaces/collection";

export function useCollectionModal(initialCollection?: Collection) {
    const [name, setName] = useState(initialCollection?.name || "");
    const [nameError, setNameError] = useState("");
    const [tags, setTags] = useState<string[]>(initialCollection?.tags || []);
    const [isLoading, setIsLoading] = useState(false);
    const { setCollections } = useCollections();

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
            setName("");
            setTags([]);
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

        const collection: Collection = {
            id: data.collection.id,
            name: data.collection.name,
            tags: data.collection.tags,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
        if (isNew) {
            setCollections((prev) => [...prev, collection]);
        } else {
            setCollections((prev) =>
                prev.map((c) => (c.id === collection.id ? collection : c))
            );
        }
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
