import {
    RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

/** Rows rendered beyond each edge of the viewport, so fast scrolling shows no gaps */
const OVERSCAN_PX = 800;

export interface VirtualRows {
    /** Where each row starts, from the top of the list */
    offsets: number[];
    /** The height of the whole list */
    totalHeight: number;
    /** The first row to render */
    start: number;
    /** One past the last row to render */
    end: number;
}

/**
 * Virtualizes a list of rows of known heights that scrolls with the window:
 * only the rows within reach of the viewport are rendered. `onScroll` is told,
 * once per animation frame, how far the top of the viewport is into the list,
 * and where the rows start.
 */
export function useWindowVirtualRows(
    listRef: RefObject<HTMLElement | null>,
    heights: number[],
    onScroll?: (viewTop: number, offsets: number[]) => void
): VirtualRows {
    const offsets = useMemo(() => {
        const result = new Array<number>(heights.length + 1);
        result[0] = 0;
        for (let i = 0; i < heights.length; i++) {
            result[i + 1] = result[i] + heights[i];
        }
        return result;
    }, [heights]);
    const [range, setRange] = useState({ start: 0, end: 0 });
    const onScrollRef = useRef(onScroll);
    onScrollRef.current = onScroll;

    const update = useCallback(() => {
        const list = listRef.current;
        if (!list) return;
        const viewTop = -list.getBoundingClientRect().top;
        const viewBottom = viewTop + window.innerHeight;
        const count = offsets.length - 1;
        // The first row that ends below the overscan above the viewport
        const start = Math.min(
            count,
            Math.max(0, firstAbove(offsets, viewTop - OVERSCAN_PX) - 1)
        );
        // One past the last row that starts above the overscan below it
        const end = Math.min(
            count,
            firstAbove(offsets, viewBottom + OVERSCAN_PX)
        );
        setRange((previous) =>
            previous.start === start && previous.end === end
                ? previous
                : { start, end }
        );
        onScrollRef.current?.(viewTop, offsets);
    }, [listRef, offsets]);

    useEffect(() => {
        let frame = 0;
        const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                update();
            });
        };
        update();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [update]);

    return {
        offsets,
        totalHeight: offsets[offsets.length - 1],
        start: range.start,
        end: range.end
    };
}

/** The index of the first sorted value greater than `value`, or the length if none is */
export function firstAbove(sorted: number[], value: number) {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (sorted[middle] > value) high = middle;
        else low = middle + 1;
    }
    return low;
}
