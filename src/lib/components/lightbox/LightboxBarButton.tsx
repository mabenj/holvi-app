import { chakra, HTMLChakraProps } from "@chakra-ui/react";
import Icon from "@mdi/react";
import { TAPPABLE_WHILE_VISIBLE } from "./lightbox-controls";

interface LightboxBarButtonProps extends Omit<
    HTMLChakraProps<"button">,
    "children"
> {
    /** Its accessible name, and its title unless one is given */
    label: string;
    /** An `@mdi/js` icon path */
    icon: string;
}

/** A button among PhotoSwipe's own in the lightbox's top bar, with their size and feel */
export default function LightboxBarButton({
    label,
    icon,
    ...props
}: LightboxBarButtonProps) {
    return (
        <chakra.button
            type="button"
            className="pswp__button"
            title={label}
            aria-label={label}
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="var(--pswp-icon-color)"
            filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))"
            css={TAPPABLE_WHILE_VISIBLE}
            {...props}>
            <Icon path={icon} size="26px" aria-hidden />
        </chakra.button>
    );
}
