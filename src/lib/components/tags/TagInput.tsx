import { fetchTagSuggestions } from "@/lib/client/collections";
import { Button, Flex, TagsInput, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

/** How long typing must pause before suggestions are fetched */
const SUGGESTION_DELAY_MS = 200;
const MAX_SUGGESTIONS = 8;

interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    invalid?: boolean;
}

/**
 * Tags as removable chips. A typed tag is added with Enter or a comma, or
 * when the input loses focus. Existing tags that match what is typed are
 * offered as buttons, which suit touch better than a dropdown.
 */
export default function TagInput({ value, onChange, invalid }: TagInputProps) {
    const [input, setInput] = useState("");
    const suggestions = useTagSuggestions(input).filter(
        (tag) => !value.some((chosen) => sameTag(chosen, tag))
    );

    const add = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !value.some((chosen) => sameTag(chosen, trimmed))) {
            onChange([...value, trimmed]);
        }
        setInput("");
    };

    return (
        <>
            <TagsInput.Root
                value={value}
                onValueChange={(details) => onChange(details.value)}
                inputValue={input}
                onInputValueChange={(details) => setInput(details.inputValue)}
                // Tags are case-insensitive
                validate={(details) =>
                    !details.value.some((tag) =>
                        sameTag(tag, details.inputValue.trim())
                    )
                }
                invalid={invalid}
                blurBehavior="add"
                addOnPaste
                delimiter=",">
                <TagsInput.Control>
                    <TagsInput.Items />
                    <TagsInput.Input placeholder="Add tags" />
                </TagsInput.Control>
                <TagsInput.HiddenInput />
            </TagsInput.Root>
            {suggestions.length > 0 && (
                <Flex gap="2" wrap="wrap" alignItems="center" mt="2">
                    <Text textStyle="xs" color="fg.muted">
                        Existing tags:
                    </Text>
                    {suggestions.slice(0, MAX_SUGGESTIONS).map((tag) => (
                        <Button
                            key={tag}
                            size="xs"
                            variant="subtle"
                            rounded="full"
                            // Keeps the input focused, so blurring does not add the typed text
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => add(tag)}>
                            {tag}
                        </Button>
                    ))}
                </Flex>
            )}
        </>
    );
}

function sameTag(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
}

/** Existing tags containing the typed text, fetched once typing pauses */
function useTagSuggestions(input: string) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const query = input.trim();
    useEffect(() => {
        if (!query) {
            setSuggestions([]);
            return;
        }
        const request = new AbortController();
        const timer = setTimeout(() => {
            fetchTagSuggestions(query, request.signal)
                .then((tags) => setSuggestions(unique(tags)))
                .catch(() => undefined);
        }, SUGGESTION_DELAY_MS);
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [query]);
    return query ? suggestions : [];
}

/** The autocomplete lists collection and file tags together, so a tag can appear twice */
function unique(tags: string[]) {
    const seen = new Set<string>();
    return tags.filter((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
