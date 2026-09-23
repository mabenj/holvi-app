import { Link } from "@chakra-ui/react";
import { Fragment } from "react";

/** http(s) addresses, leaving out punctuation that ends a sentence around them */
const URL_PATTERN = /https?:\/\/[^\s<>"]*[^\s<>".,:;!?')\]]/g;

/** Splits text into plain parts and web addresses */
export function splitLinks(text: string) {
    const parts: { text: string; href?: string }[] = [];
    let end = 0;
    const pattern = new RegExp(URL_PATTERN);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        if (start > end) parts.push({ text: text.slice(end, start) });
        parts.push({ text: match[0], href: match[0] });
        end = start + match[0].length;
    }
    if (end < text.length) parts.push({ text: text.slice(end) });
    return parts;
}

/** Text whose web addresses are links that open in a new tab */
export default function LinkifiedText({ text }: { text: string }) {
    return (
        <>
            {splitLinks(text).map((part, i) =>
                part.href ? (
                    <Link
                        key={i}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        colorPalette="blue"
                        color="colorPalette.fg"
                        wordBreak="break-all">
                        {part.text}
                    </Link>
                ) : (
                    <Fragment key={i}>{part.text}</Fragment>
                )
            )}
        </>
    );
}
