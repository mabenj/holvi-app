import { Menu, Portal } from "@chakra-ui/react";
import { mdiDeleteOutline, mdiDotsVertical, mdiPencilOutline } from "@mdi/js";
import Icon from "@mdi/react";
import TitleBarButton from "./TitleBarButton";

interface CollectionMenuProps {
    /** Whether the title bar has collapsed onto the page, rather than lying over the Cover */
    collapsed: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

/** The collection page's overflow menu, keeping rare and destructive actions out of the way */
export default function CollectionMenu({
    collapsed,
    onEdit,
    onDelete
}: CollectionMenuProps) {
    return (
        <Menu.Root
            positioning={{ placement: "bottom-end" }}
            onSelect={({ value }) => (value === "edit" ? onEdit() : onDelete())}>
            <Menu.Trigger asChild>
                <TitleBarButton
                    aria-label="More actions"
                    icon={mdiDotsVertical}
                    collapsed={collapsed}
                />
            </Menu.Trigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content minW="44">
                        <Menu.Item value="edit">
                            <Icon path={mdiPencilOutline} size="18px" aria-hidden />
                            Edit
                        </Menu.Item>
                        <Menu.Item
                            value="delete"
                            color="fg.error"
                            _hover={{ bg: "bg.error", color: "fg.error" }}>
                            <Icon path={mdiDeleteOutline} size="18px" aria-hidden />
                            Delete
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
}
