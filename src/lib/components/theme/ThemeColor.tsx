import { useTheme } from "next-themes";
import { useEffect } from "react";
import { DARK_BACKGROUND, LIGHT_BACKGROUND } from "./system";

/** Keeps the browser chrome colour (`theme-color`) in step with the active theme */
export default function ThemeColor() {
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        meta?.setAttribute(
            "content",
            resolvedTheme === "light" ? LIGHT_BACKGROUND : DARK_BACKGROUND
        );
    }, [resolvedTheme]);

    return null;
}
