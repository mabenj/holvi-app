import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { Button, IconButton, useColorMode } from "@chakra-ui/react";

export default function ColorModeToggle({ label }: { label?: string }) {
    const { colorMode, toggleColorMode } = useColorMode();

    const props = {
        variant: "ghost",
        title: colorMode === "dark" ? "Light mode" : "Dark mode",
        "aria-label": colorMode === "dark" ? "Light mode" : "Dark mode",
        onClick: () => toggleColorMode(),
        size: "sm"
    };
    const icon = colorMode === "dark" ? <SunIcon /> : <MoonIcon />;

    if (label) {
        return (
            <Button {...props} leftIcon={icon}>
                {label}
            </Button>
        );
    }

    return <IconButton {...props} icon={icon} />;
}
