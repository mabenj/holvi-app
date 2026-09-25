import { useResolvedGridLayout } from "@/lib/components/grid/useGridLayout";
import {
    firstAbove,
    useWindowVirtualRows
} from "@/lib/hooks/useWindowVirtualRows";
import { useHoldGesture } from "@/lib/hooks/useHoldGesture";
import type { Selection } from "@/lib/hooks/useSelection";
import { useTileCycling } from "@/lib/hooks/useTileCycling";
import { FileSummary } from "@/lib/types/file-summary";
import { Box, chakra, Skeleton, Text } from "@chakra-ui/react";
import {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import FileTile from "../grid/FileTile";
import { HOLDABLE_GRID } from "../grid/holdable-grid";
import { revealTile } from "../lightbox/file-tiles";
import { FILE_TILE_ATTRIBUTE } from "../lightbox/lightbox-slides";
import SelectionMark from "../selection/SelectionMark";
import { TAB_BAR_HEIGHT } from "../theme/system";
import { rowOfFile, TimelineRow, timelineRows } from "./timeline-rows";

/** Height of a month header, in pixels */
const MONTH_HEIGHT = 40;
/** The hairline between tiles, in pixels, as in the other grids */
const GAP = 2;

interface TimelineGridProps {
    /** Newest first */
    files: FileSummary[];
    /** A row of skeleton tiles after the files, while the next page loads */
    loadingMore?: boolean;
    /** Where files can be selected: lifting a hold in place starts selecting, and taps then toggle files */
    selection?: Selection;
    /** Tapping a file's tile outside selection, e.g. to open it in the lightbox */
    onOpen?: (fileId: string) => void;
    /**
     * The file open in the lightbox. Its tile stays rendered and in view
     * however far the lightbox moves from what was scrolled to, so closing
     * can zoom back into it.
     */
    activeFileId?: string | null;
    /**
     * Called once the rows are laid out and before the page paints, e.g. to
     * restore the scroll position; the rows then in view render before it
     * paints too
     */
    onLaidOut?: () => void;
}

/**
 * The Timeline's files under sticky month headers, in the same tiles and
 * density as the other grids. It is virtualized: only the rows near the
 * viewport are rendered, so it stays smooth across the whole library.
 */
export default function TimelineGrid({
    files,
    loadingMore = false,
    selection,
    onOpen,
    activeFileId = null,
    onLaidOut
}: TimelineGridProps) {
    const layout = useResolvedGridLayout();
    const laidOut = layout !== null;
    const columns = layout?.columns ?? 1;
    const rowHeight = (layout?.tileHeightPx ?? 0) + GAP;
    const rows = useMemo(() => timelineRows(files, columns), [files, columns]);
    const heights = useMemo(
        () => [
            ...rows.map((row) =>
                row.kind === "month" ? MONTH_HEIGHT : rowHeight
            ),
            ...(loadingMore ? [rowHeight] : [])
        ],
        [rows, rowHeight, loadingMore]
    );
    // Where each month's header row is, to tell which month is at the top
    const monthRows = useMemo(
        () =>
            rows.flatMap((row, index) => (row.kind === "month" ? [index] : [])),
        [rows]
    );

    const listRef = useRef<HTMLDivElement>(null);
    // The hold gesture listens on the list, so it needs it as state
    // to attach once it mounts; the virtualizer reads it through the ref
    const [list, setList] = useState<HTMLDivElement | null>(null);
    const attachList = useCallback((element: HTMLDivElement | null) => {
        listRef.current = element;
        setList(element);
    }, []);
    const heldId = useHoldGesture(list, FILE_TILE_ATTRIBUTE, selection);
    const { cyclingId, frame } = useTileCycling(
        list,
        FILE_TILE_ATTRIBUTE,
        heldId
    );
    const selecting = selection?.selecting ?? false;
    const isSelected = selection?.isSelected;
    const stickyRef = useRef<HTMLDivElement>(null);
    const [stuckMonth, setStuckMonth] = useState<string | null>(null);
    // Where the sticky header sticks, below the safe-area inset; read again after a resize
    const stickyTop = useRef<number | null>(null);
    useEffect(() => {
        const forget = () => (stickyTop.current = null);
        window.addEventListener("resize", forget);
        return () => window.removeEventListener("resize", forget);
    }, []);
    // Where each month's header starts, for the rows' latest offsets
    const monthStarts = useRef({
        offsets: [] as number[],
        starts: [] as number[]
    });

    // Shows the month at the top of the screen in the sticky header, and lets
    // the next month's header push it up as it arrives
    const onScroll = useCallback(
        (viewTop: number, offsets: number[]) => {
            const sticky = stickyRef.current;
            if (!sticky || monthRows.length === 0) return;
            stickyTop.current ??= parseFloat(getComputedStyle(sticky).top) || 0;
            if (monthStarts.current.offsets !== offsets) {
                monthStarts.current = {
                    offsets,
                    starts: monthRows.map((row) => offsets[row])
                };
            }
            const { starts } = monthStarts.current;
            const line = viewTop + stickyTop.current;
            const current = Math.max(0, firstAbove(starts, line) - 1);
            setStuckMonth((rows[monthRows[current]] as TimelineRow).month);
            const next = starts[current + 1];
            const push =
                next === undefined
                    ? 0
                    : Math.min(0, next - line - MONTH_HEIGHT);
            sticky.style.transform = push ? `translateY(${push}px)` : "";
        },
        [monthRows, rows]
    );
    // Before the virtualizer's own layout effect, so it renders the rows
    // wherever this scrolls to
    useLayoutEffect(() => {
        if (laidOut) onLaidOut?.();
    }, [laidOut, onLaidOut]);
    const { offsets, totalHeight, start, end } = useWindowVirtualRows(
        listRef,
        heights,
        onScroll
    );

    // The last file open in the lightbox stays pinned after it closes, so the
    // closing zoom still has its tile while history catches up
    const [pinnedFileId, setPinnedFileId] = useState(activeFileId);
    if (activeFileId && activeFileId !== pinnedFileId) {
        setPinnedFileId(activeFileId);
    }
    const pinnedRow = useMemo(
        () => (pinnedFileId ? rowOfFile(rows, pinnedFileId) : -1),
        [rows, pinnedFileId]
    );
    // Follows the lightbox: scrolling the active file's tile into view brings
    // the rows around it along, and leaves the Timeline there once it closes
    useLayoutEffect(() => {
        if (activeFileId && pinnedRow >= 0) revealTile(activeFileId);
    }, [activeFileId, pinnedRow]);
    // The rows in reach of the viewport, and the pinned one wherever it is
    const rendered = useMemo(() => {
        const indices = Array.from({ length: end - start }, (_, i) => start + i);
        if (pinnedRow >= 0 && (pinnedRow < start || pinnedRow >= end)) {
            indices.push(pinnedRow);
        }
        return indices;
    }, [start, end, pinnedRow]);

    if (!layout) {
        return null;
    }
    const firstMonth = rows[0]?.month ?? "";
    return (
        <>
            <Box
                ref={stickyRef}
                position="sticky"
                top="env(safe-area-inset-top)"
                zIndex="docked"
                // Covers the notch above the header, where the files scroll by
                boxShadow="0 calc(-1 * env(safe-area-inset-top)) 0 0 var(--chakra-colors-bg)"
                aria-hidden>
                <MonthHeader month={stuckMonth ?? firstMonth} />
            </Box>
            <Box
                ref={attachList}
                aria-label="Timeline"
                position="relative"
                css={HOLDABLE_GRID}
                // The first month's own header sits under the sticky one
                mt={`-${MONTH_HEIGHT}px`}
                h={`${totalHeight}px`}>
                {rendered.map((index) => {
                    const row = rows[index];
                    // Only the row with the cycling tile re-renders as it cycles
                    const cycling =
                        row?.kind === "files" &&
                        row.files.some((file) => file.id === cyclingId);
                    return (
                        <VirtualRow
                            key={row?.key ?? "loading"}
                            row={row}
                            top={offsets[index]}
                            height={heights[index]}
                            columns={columns}
                            selecting={selecting}
                            isSelected={isSelected}
                            onOpen={onOpen}
                            cyclingId={cycling ? cyclingId : null}
                            frame={cycling ? frame : null}
                        />
                    );
                })}
            </Box>
        </>
    );
}

interface VirtualRowProps {
    /** Undefined for the skeleton row while the next page loads */
    row: TimelineRow | undefined;
    top: number;
    height: number;
    columns: number;
    selecting: boolean;
    isSelected: ((fileId: string) => boolean) | undefined;
    onOpen?: (fileId: string) => void;
    /** The row's cycling tile (see `useTileCycling`), or null if none of its tiles cycles */
    cyclingId: string | null;
    /** The frame that tile is on, or null */
    frame: number | null;
}

/**
 * Whether a row would look the same. The rows are rebuilt as pages arrive, but
 * a row with the same key and number of files shows the same files.
 */
function sameRow(a: VirtualRowProps, b: VirtualRowProps) {
    return (
        a.top === b.top &&
        a.height === b.height &&
        a.columns === b.columns &&
        a.selecting === b.selecting &&
        a.isSelected === b.isSelected &&
        a.onOpen === b.onOpen &&
        a.cyclingId === b.cyclingId &&
        a.frame === b.frame &&
        a.row?.key === b.row?.key &&
        (a.row?.kind === "files" ? a.row.files.length : 0) ===
            (b.row?.kind === "files" ? b.row.files.length : 0)
    );
}

/** One row of the grid, placed at its offset; unchanged rows skip re-rendering */
const VirtualRow = memo(function VirtualRow({
    row,
    top,
    height,
    columns,
    selecting,
    isSelected,
    onOpen,
    cyclingId,
    frame
}: VirtualRowProps) {
    return (
        <Box
            role={row?.kind === "month" ? "heading" : undefined}
            aria-level={row?.kind === "month" ? 2 : undefined}
            data-timeline-row={row?.kind ?? "loading"}
            position="absolute"
            top="0"
            left="0"
            right="0"
            h={`${height}px`}
            style={{ transform: `translateY(${top}px)` }}>
            {row?.kind === "month" ? (
                <MonthHeader month={row.month} />
            ) : (
                <Box
                    display="grid"
                    gridTemplateColumns={`repeat(${columns}, minmax(0, 1fr))`}
                    gap={`${GAP}px`}
                    h={`${height - GAP}px`}>
                    {row
                        ? row.files.map((file) => (
                              <chakra.button
                                  key={file.id}
                                  type="button"
                                  aria-label={file.name}
                                  aria-pressed={
                                      selecting
                                          ? (isSelected?.(file.id) ?? false)
                                          : undefined
                                  }
                                  {...{ [FILE_TILE_ATTRIBUTE]: file.id }}
                                  display="block"
                                  position="relative"
                                  h="100%"
                                  cursor="pointer"
                                  // Scrolling a tile into view keeps it clear
                                  // of the sticky month and the tab bar
                                  scrollMarginTop={`calc(${MONTH_HEIGHT}px + env(safe-area-inset-top))`}
                                  scrollMarginBottom={`calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`}
                                  // While selecting, the hold gesture takes
                                  // the click, so it toggles instead
                                  onClick={() => onOpen?.(file.id)}>
                                  <FileTile
                                      file={file}
                                      frame={
                                          file.id === cyclingId ? frame : null
                                      }
                                  />
                                  {selecting && (
                                      <SelectionMark
                                          selected={
                                              isSelected?.(file.id) ?? false
                                          }
                                      />
                                  )}
                              </chakra.button>
                          ))
                        : Array.from({ length: columns }, (_, i) => (
                              <Skeleton key={i} h="100%" rounded="none" />
                          ))}
                </Box>
            )}
        </Box>
    );
}, sameRow);

function MonthHeader({ month }: { month: string }) {
    return (
        <Box
            h={`${MONTH_HEIGHT}px`}
            px="4"
            display="flex"
            alignItems="center"
            bg="bg">
            <Text textStyle="sm" fontWeight="semibold">
                {month}
            </Text>
        </Box>
    );
}
