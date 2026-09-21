import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/** Near-black page colour of the dark theme; also the browser chrome colour */
export const DARK_BACKGROUND = "#0a0a0b";
export const LIGHT_BACKGROUND = "#ffffff";

/** Height of the bottom tab bar, not counting the safe-area inset below it */
export const TAB_BAR_HEIGHT = "56px";

const config = defineConfig({
    globalCss: {
        "html, body": {
            bg: "bg",
            color: "fg",
            // Flat surfaces: the photos carry the colour
            backgroundImage: "none",
            WebkitTapHighlightColor: "transparent",
            overscrollBehaviorY: "none"
        },
        body: {
            minHeight: "100dvh"
        }
    },
    theme: {
        semanticTokens: {
            colors: {
                bg: {
                    DEFAULT: {
                        value: {
                            _light: LIGHT_BACKGROUND,
                            _dark: DARK_BACKGROUND
                        }
                    },
                    // Raised surfaces (tab bar, sheets, dialogs) stay flat, one step lighter
                    panel: {
                        value: { _light: "{colors.white}", _dark: "#141416" }
                    },
                    subtle: {
                        value: { _light: "{colors.gray.50}", _dark: "#111113" }
                    },
                    muted: {
                        value: { _light: "{colors.gray.100}", _dark: "#1c1c1f" }
                    }
                },
                border: {
                    DEFAULT: {
                        value: { _light: "{colors.gray.200}", _dark: "#26262a" }
                    }
                }
            }
        }
    }
});

export const system = createSystem(defaultConfig, config);
