import { useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../common/utilities";
import { useHttp } from "./useHttp";

export function useItemSelect() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selection, setSelection] = useState<Record<string, boolean>>({});

    const http = useHttp();
    const toast = useToast();

    useEffect(() => {
        setSelection({});
    }, [isSelectMode]);

    const toggleSelected = (id: string) => {
        setSelection((prev) => {
            prev[id] = !prev[id];
            return { ...prev };
        });
    };

    const deleteSelected = async () => {
        setIsDeleting(true);
        const idsToDelete = Object.keys(selection).filter(
            (id) => selection[id]
        );
        const { error } = await http
            .post(`/api/multiDelete`, {
                payload: idsToDelete
            })
            .finally(() => setIsDeleting(false));

        if (error) {
            toast({
                description: `Error while deleting (${getErrorMessage(error)})`,
                status: "error"
            });
            return Promise.reject(error);
        }

        toast({
            description:
                idsToDelete.length === 1
                    ? "Item deleted"
                    : `${idsToDelete.length} items deleted`,
            status: "info"
        });

        setIsSelectMode(false);
        return idsToDelete;
    };

    return {
        selection: selection,
        isSelectModeOn: isSelectMode,
        toggleSelectMode: () => setIsSelectMode((prev) => !prev),
        toggleSelected: toggleSelected,
        deleteSelected: deleteSelected,
        isDeleting: false
    };
}
