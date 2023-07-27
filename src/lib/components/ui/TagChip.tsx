import { Tag, TagCloseButton, TagLabel } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function TagChip({
    tag,
    onClose
}: {
    tag: string;
    onClose?: () => void;
}) {
    const [color, setColor] = useState(COLOR_SCHEMES[0]);

    useEffect(() => {
        let random = 0;
        for (let i = 0; i < tag.length; i++) {
            random += tag.charCodeAt(i);
        }
        setColor(COLOR_SCHEMES[random % COLOR_SCHEMES.length]);
    }, [tag]);

    return (
        <Tag borderRadius="full" colorScheme={color}>
            <TagLabel>{tag}</TagLabel>
            {typeof onClose === "function" && (
                <TagCloseButton onClick={onClose} />
            )}
        </Tag>
    );
}

const COLOR_SCHEMES = [
    "gray",
    "red",
    "orange",
    "yellow",
    "green",
    "teal",
    "blue",
    "cyan",
    "purple",
    "pink",
    "linkedin",
    "facebook",
    "messenger",
    "whatsapp",
    "twitter",
    "telegram"
];
