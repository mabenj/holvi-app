import { useEffect, useRef } from "react";

/**
 * A ref for an element at the end of a paged grid. It calls `onNear` once the
 * element comes within one screen of the viewport. `pageCount` re-arms it after
 * every page, in case the element is still that close. Pass no `onNear` to
 * disarm it, e.g. while nothing more can load.
 */
export function useNextPageSentinel(
    onNear: (() => void) | undefined,
    pageCount: number
) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element || !onNear) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onNear();
            },
            { rootMargin: "0px 0px 100% 0px" }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [onNear, pageCount]);
    return ref;
}
