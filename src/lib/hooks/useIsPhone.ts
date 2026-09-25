import { useMediaQuery } from "./useMediaQuery";

// Below Chakra's `md` breakpoint (48rem)
const PHONE_QUERY = "(max-width: 47.99rem)";

/**
 * Whether the viewport is phone-sized. Always false during server rendering,
 * so use it only for things that appear after an interaction, such as sheets.
 */
export function useIsPhone() {
    return useMediaQuery(PHONE_QUERY, false);
}
