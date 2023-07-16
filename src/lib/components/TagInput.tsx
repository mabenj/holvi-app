import {
    Box,
    Flex,
    Input,
    Tag,
    TagCloseButton,
    TagLabel,
    useColorModeValue
} from "@chakra-ui/react";
import { KeyboardEvent, useState } from "react";

interface TagInputProps {
    value?: string[];
    onChange: (value: string[]) => void;
    onBlur: () => void;
}

export default function TagInput({ value, onChange, onBlur }: TagInputProps) {
    const [inputValue, setInputValue] = useState("");
    const borderColor = useColorModeValue("gray.200", "gray.600");

    const addTag = (tag: string) => {
        setInputValue("");
        tag = tag.trim();
        if (value?.includes(tag.toLowerCase())) {
            return;
        }
        onChange([...(value || []), tag]);
    };

    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "Enter": {
                if (!inputValue) {
                    // submit
                    break;
                }
                // fall through
            }
            case "Tab":
            case ",": {
                e.preventDefault();
                addTag(inputValue);
                break;
            }
            default:
            // nothing
        }
    };

    const removeTag = (index: number) => {
        value?.splice(index, 1);
        onChange([...(value || [])]);
    };

    return (
        <Flex
            flexWrap="wrap"
            p={2}
            rounded="md"
            border="1px solid"
            borderColor={borderColor}>
            {value?.map((value, i) => (
                <Tag key={value} borderRadius="full" m={1}>
                    <TagLabel>{value}</TagLabel>
                    <TagCloseButton onClick={() => removeTag(i)} />
                </Tag>
            ))}
            <Box minW="1rem" flexGrow="1">
                <Input
                    variant="unstyled"
                    placeholder="Enter tags..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    m={1}
                    onBlur={onBlur}
                />
            </Box>
        </Flex>
    );
}
