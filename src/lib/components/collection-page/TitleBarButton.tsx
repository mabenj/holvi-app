import { IconButton, IconButtonProps } from "@chakra-ui/react";
import Icon from "@mdi/react";

interface TitleBarButtonProps extends Omit<IconButtonProps, "children"> {
    /** Icon path from @mdi/js */
    icon: string;
    /** Whether the title bar has collapsed onto the page, rather than lying over the Cover */
    collapsed: boolean;
}

/**
 * An icon button in the collection page's title bar. Over the Cover it is
 * white with a shadow, so it stays visible on any photo; once the bar has
 * collapsed it takes the page's colours.
 */
export default function TitleBarButton({
    icon,
    collapsed,
    ...props
}: TitleBarButtonProps) {
    const hoverBg = collapsed ? "bg.muted" : "blackAlpha.300";
    return (
        <IconButton
            variant="ghost"
            color="inherit"
            rounded="full"
            _hover={{ bg: hoverBg }}
            _expanded={{ bg: hoverBg }}
            {...props}>
            <Icon
                path={icon}
                size="24px"
                style={{
                    filter: collapsed
                        ? undefined
                        : "drop-shadow(0 0 2px rgba(0, 0, 0, 0.6))"
                }}
                aria-hidden
            />
        </IconButton>
    );
}
