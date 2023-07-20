import {
    Box,
    Flex,
    Input,
    Tag,
    TagCloseButton,
    TagLabel,
    useColorModeValue
} from "@chakra-ui/react";
import { KeyboardEvent, useEffect, useState } from "react";
import { ApiData } from "../common/api-route";
import useDebounce from "../hooks/useDebounce";
import { useHttp } from "../hooks/useHttp";

interface TagInputProps {
    value?: string[];
    onChange: (value: string[]) => void;
    onBlur: () => void;
}

export default function TagInput({ value, onChange, onBlur }: TagInputProps) {
    const [inputValue, setInputValue] = useState("");
    const query = useDebounce(inputValue);
    const [suggestions, setSuggestions] = useState([] as string[]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const http = useHttp();

    const borderColor = useColorModeValue("gray.200", "gray.600");
    const suggestionsBg = useColorModeValue("white", "gray.600");
    const activeSuggestionBg = useColorModeValue("gray.100", "gray.700");

    useEffect(() => {
        if (!query) {
            setActiveSuggestionIndex(-1);
            setSuggestions([]);
            return;
        }

        async function getSuggestions() {
            const { data, error } = await http.get<ApiData<{ tags: string[] }>>(
                `/api/search/tags?query=${query}`
            );
            if (!data || data.status === "error" || error) {
                return;
            }
            setActiveSuggestionIndex(-1);
            setSuggestions(data.tags);
        }

        getSuggestions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

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
                    // submit form
                    break;
                }
                // fall through
            }
            case "Tab":
            case ",": {
                e.preventDefault();
                if (activeSuggestionIndex > -1) {
                    addTag(suggestions[activeSuggestionIndex]);
                } else {
                    addTag(inputValue);
                }
                break;
            }
            case "ArrowUp": {
                e.preventDefault();
                setActiveSuggestionIndex((prev) => Math.max(prev - 1, -1));
                break;
            }
            case "ArrowDown": {
                e.preventDefault();
                setActiveSuggestionIndex((prev) =>
                    Math.min(prev + 1, suggestions.length - 1)
                );
                break;
            }
            default:
            // nothing
        }
    };

    const handleInputChange = (value: string) => {
        setSuggestions([]);
        setInputValue(value);
    };

    const removeTag = (index: number) => {
        value?.splice(index, 1);
        onChange([...(value || [])]);
    };

    return (
        <>
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
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        m={1}
                        onBlur={onBlur}
                    />
                </Box>
            </Flex>
            {inputValue && suggestions.length > 0 && (
                <Flex
                    direction="column"
                    w="100%"
                    maxH="400px"
                    bg={suggestionsBg}
                    zIndex={1}
                    position="absolute"
                    rounded="md"
                    shadow="base"
                    border="1px solid"
                    borderColor={borderColor}
                    mt={1}
                    overflowX="hidden"
                    overflowY="auto">
                    {suggestions.map((suggestion, i) => (
                        <Box
                            key={suggestion}
                            px={5}
                            py={2}
                            cursor="pointer"
                            backgroundColor={
                                activeSuggestionIndex === i
                                    ? activeSuggestionBg
                                    : undefined
                            }
                            _hover={{
                                backgroundColor: activeSuggestionBg
                            }}
                            onClick={() => addTag(suggestions[i])}>
                            {suggestion}
                        </Box>
                    ))}
                </Flex>
            )}
        </>
    );
}
