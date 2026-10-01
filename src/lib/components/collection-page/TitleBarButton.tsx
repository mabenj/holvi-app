import { IconButton, IconButtonProps } from "@chakra-ui/react";
import Icon from "@mdi/react";

interface TitleBarButtonProps extends Omit<IconButtonProps, "children"> {
    /** Icon path from @mdi/js */
    icon: string;
}

/** An icon button in the collection page's title bar */
export default function TitleBarButton({
    icon,
    ...props
}: TitleBarButtonProps) {
    return (
        <IconButton
            variant="ghost"
            color="inherit"
            rounded="full"
            _hover={{ bg: "bg.muted" }}
            _expanded={{ bg: "bg.muted" }}
            {...props}>
            <Icon path={icon} size="24px" aria-hidden />
        </IconButton>
    );
}
