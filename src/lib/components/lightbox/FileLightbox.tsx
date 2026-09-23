import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";
import { FileSummary } from "@/lib/types/file-summary";
import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { mdiMapMarkerOutline } from "@mdi/js";
import Icon from "@mdi/react";
import PhotoSwipe from "photoswipe";
import {
    Dispatch,
    ReactNode,
    SetStateAction,
    useEffect,
    useRef,
    useState
} from "react";
import { createPortal } from "react-dom";
import {
    FILE_TILE_ATTRIBUTE,
    FileSlideData,
    formatTakenAt,
    isNearEnd,
    mapLink,
    toSlideData
} from "./lightbox-slides";
import { addVideoSlides } from "./video-slides";
import VideoControls from "./VideoControls";

interface FileLightboxProps {
    /** The loaded files, in the order the lightbox swipes through them */
    files: FileSummary[];
    /** Called when the active file nears the end of the loaded files */
    onNearEnd?: () => void;
    /** Actions for the active file in the top bar, e.g. "Set as cover" */
    actions?: (file: FileSummary) => ReactNode;
}

/** The active slide's video, which the video controls drive */
interface ActiveVideo {
    fileId: string;
    video: HTMLVideoElement;
}

/** Where the lightbox renders its caption and actions, once it is open */
interface LightboxUi {
    pswp: PhotoSwipe;
    caption: HTMLElement;
    actions: HTMLElement;
    index: number;
}

/**
 * Shows the file named by the `?photoId` query over the page, zooming out of
 * its tile. Swiping goes through the loaded files and asks for more near the
 * end; closing zooms back into the active file's tile. Tiles carry
 * `FILE_TILE_ATTRIBUTE` and open the lightbox with `useLightboxHistory().open`.
 */
export default function FileLightbox({
    files,
    onNearEnd,
    actions
}: FileLightboxProps) {
    const { photoId, show, leave } = useLightboxHistory();
    const [ui, setUi] = useState<LightboxUi | null>(null);
    const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
    const pswpRef = useRef<PhotoSwipe | null>(null);

    // PhotoSwipe reads the latest of these while it is open
    const latest = useRef({ files, onNearEnd, show, leave });
    latest.current = { files, onNearEnd, show, leave };

    // Opens with the query and closes when it goes, e.g. on Back
    useEffect(() => {
        const pswp = pswpRef.current;
        if (photoId && !pswp) {
            const index = files.findIndex((file) => file.id === photoId);
            if (index >= 0) {
                pswpRef.current = openLightbox(
                    index,
                    latest,
                    setActiveVideo,
                    (ui) => {
                        setUi(ui);
                        if (!ui) pswpRef.current = null;
                    }
                );
            } else if (files.length > 0) {
                // A file that is not loaded, e.g. after a reload, or is gone
                leave();
            }
        } else if (!photoId && pswp && !pswp.isDestroying) {
            closedByHistory.add(pswp);
            pswp.close();
        }
    }, [photoId, files, leave]);

    // Slides past the previously loaded files were left empty: fill them
    const loadedCount = useRef(files.length);
    useEffect(() => {
        const previous = loadedCount.current;
        loadedCount.current = files.length;
        const pswp = pswpRef.current;
        if (!pswp || files.length <= previous) return;
        for (let i = pswp.currIndex - 1; i <= pswp.currIndex + 1; i++) {
            if (i >= previous && i < files.length) {
                pswp.refreshSlideContent(i);
            }
        }
    }, [files.length]);

    useEffect(() => () => pswpRef.current?.destroy(), []);

    const file = ui ? files[ui.index] : undefined;
    if (!ui || !file) {
        return null;
    }
    const video = activeVideo?.fileId === file.id ? activeVideo.video : null;
    return (
        <>
            {createPortal(
                <Caption file={file}>
                    {video && (
                        <VideoControls
                            // Each video starts with fresh controls
                            key={file.id}
                            pswp={ui.pswp}
                            video={video}
                            knownDuration={file.durationInSeconds}
                        />
                    )}
                </Caption>,
                ui.caption
            )}
            {actions && createPortal(actions(file), ui.actions)}
        </>
    );
}

/** Lightboxes closing because history left their entry, not by themselves */
const closedByHistory = new WeakSet<PhotoSwipe>();

function openLightbox(
    index: number,
    latest: React.RefObject<{
        files: FileSummary[];
        onNearEnd?: () => void;
        show: (fileId: string) => void;
        leave: () => void;
    }>,
    onActiveVideo: Dispatch<SetStateAction<ActiveVideo | null>>,
    /** The caption and actions to render into, or null once it is gone */
    onUi: (ui: LightboxUi | null) => void
) {
    const pswp = new PhotoSwipe({
        index,
        // The slides come from the loaded files, which grow while it is open
        dataSource: [],
        bgOpacity: 1,
        // Wrapping round would jump from the last loaded file to the first
        // while the next page is on its way
        loop: false,
        wheelToZoom: true,
        // The loaded files are not all of them, so "3 / 48" would mislead
        counter: false,
        // Tapping the photo toggles the controls rather than closing it
        imageClickAction: "zoom",
        tapAction: "toggle-controls",
        // Focus goes to the active file's tile instead (see "destroy"): the
        // tapped one may be far away by now, and focusing it would scroll
        returnFocus: false
    });
    const files = () => latest.current.files;

    pswp.addFilter("numItems", () => files().length);
    pswp.addFilter("itemData", (_, i) => toSlideData(files()[i]));
    pswp.addFilter(
        "thumbEl",
        // Without a tile it fades instead (the filter's type omits that case)
        (thumbnail, data) =>
            tileThumbnail((data as FileSlideData).fileId) ??
            (thumbnail as HTMLElement)
    );
    addVideoSlides(pswp, {
        onActivate: (video, fileId) => onActiveVideo({ fileId, video }),
        onDeactivate: (video) =>
            onActiveVideo((active) => (active?.video === video ? null : active))
    });

    let caption: HTMLElement | null = null;
    let actions: HTMLElement | null = null;
    pswp.on("uiRegister", () => {
        pswp.ui?.registerElement({
            name: "file-actions",
            appendTo: "bar",
            // Between the zoom button and the close button
            order: 15,
            onInit: (element) => {
                actions = element;
            }
        });
        pswp.ui?.registerElement({
            name: "file-caption",
            // Fades with the other controls
            className: "pswp__file-caption pswp__hide-on-close",
            appendTo: "root",
            onInit: (element) => {
                caption = element;
            }
        });
    });

    pswp.on("change", () => {
        const file = files()[pswp.currIndex];
        if (!file) return;
        if (caption && actions) {
            onUi({ pswp, caption, actions, index: pswp.currIndex });
        }
        latest.current.show(file.id);
        if (isNearEnd(pswp.currIndex, files().length)) {
            latest.current.onNearEnd?.();
        }
    });

    pswp.on("close", () => {
        const file = files()[pswp.currIndex];
        // The closing zoom needs the active file's tile on screen, however
        // far the swipes went
        if (file) revealTile(file.id);
        if (!closedByHistory.has(pswp)) latest.current.leave();
    });
    pswp.on("destroy", () => {
        const file = files()[pswp.currIndex];
        if (file) tileOf(file.id)?.focus({ preventScroll: true });
        onUi(null);
    });

    pswp.init();
    return pswp;
}

function tileOf(fileId: string) {
    return document.querySelector<HTMLElement>(
        `[${FILE_TILE_ATTRIBUTE}="${CSS.escape(fileId)}"]`
    );
}

function tileThumbnail(fileId: string) {
    return tileOf(fileId)?.querySelector<HTMLElement>("img") ?? null;
}

/** Scrolls a file's tile into view, clear of the bars (the tiles' scroll margins) */
function revealTile(fileId: string) {
    tileOf(fileId)?.scrollIntoView({ block: "nearest", behavior: "instant" });
}

/**
 * When the file was taken and, when known, where, with a link to a map.
 * A video's controls go beneath it.
 */
function Caption({
    file,
    children
}: {
    file: FileSummary;
    children?: ReactNode;
}) {
    return (
        <Box
            position="absolute"
            insetX="0"
            bottom="0"
            px="4"
            pt="10"
            pb="calc(var(--chakra-spacing-4) + env(safe-area-inset-bottom))"
            color="white"
            textShadow="0 1px 2px rgba(0, 0, 0, 0.6)"
            bgGradient="to-t"
            gradientFrom="blackAlpha.700"
            gradientTo="transparent"
            pointerEvents="none">
            <Text fontSize="sm" fontWeight="medium">
                {formatTakenAt(file.timestamp)}
            </Text>
            {file.gps && (
                <Link
                    href={mapLink(file.gps)}
                    target="_blank"
                    rel="noreferrer"
                    color="white"
                    fontSize="sm"
                    pointerEvents="auto">
                    <Flex as="span" alignItems="center" gap="1">
                        <Icon
                            path={mdiMapMarkerOutline}
                            size="16px"
                            aria-hidden
                        />
                        {file.gps.label || "Show on map"}
                    </Flex>
                </Link>
            )}
            {children}
        </Box>
    );
}
