import { Link } from "@chakra-ui/next-js";
import { Box, Flex } from "@chakra-ui/react";
import { mdiMapMarker } from "@mdi/js";
import Icon from "@mdi/react";
import { useRouter } from "next/router";
import {
    HTMLAttributes,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";
import { PhotoSlider } from "react-photo-view";
import { DataType } from "react-photo-view/dist/types";
import { formatDate } from "../common/utilities";
import { CollectionGridItem } from "../types/collection-grid-item";

interface PhotoViewerState {
    currentItemId: string | null;
    videoRefMap: Map<string, React.MutableRefObject<HTMLVideoElement | null>>;
}

const PhotoViewerContext = createContext<PhotoViewerState>({
    currentItemId: null,
    videoRefMap: new Map()
});

export function PhotoViewerProvider({
    children,
    items
}: {
    children: React.ReactNode;
    items: CollectionGridItem[];
}) {
    const [photos, setPhotos] = useState(gridItemsToDataType(items));
    const [index, setIndex] = useState(-1);
    const [currentItem, setCurrentItem] = useState<CollectionGridItem | null>(
        null
    );
    const videoRefMap = useRef(
        new Map<string, React.MutableRefObject<HTMLVideoElement | null>>()
    );

    const router = useRouter();
    const { photoId } = router.query as { photoId?: string };

    useEffect(() => {
        setPhotos(gridItemsToDataType(items));
    }, [items]);

    useEffect(() => {
        const activeItem = items.find((item) => item.id === photoId);
        setIndex(activeItem ? items.indexOf(activeItem) : -1);
        setCurrentItem(activeItem || null);
    }, [items, photoId]);

    const handleIndexChange = (index: number) => {
        pauseActiveVideo();
        const itemId = photos[index].key;

        router.replace(
            {
                pathname: window.location.pathname,
                query: {
                    photoId: itemId
                }
            },
            undefined,
            { shallow: true }
        );
    };

    const handleClose = () => {
        pauseActiveVideo();

        router.push(
            {
                pathname: window.location.pathname,
                query: {}
            },
            undefined,
            {
                shallow: true
            }
        );
    };

    const pauseActiveVideo = () => {
        if (!currentItem) {
            return;
        }
        const videoRef = videoRefMap.current.get(currentItem.id);
        videoRef?.current?.pause();
    };

    return (
        <PhotoViewerContext.Provider
            value={{
                currentItemId: currentItem?.id || null,
                videoRefMap: videoRefMap.current
            }}>
            {children}
            <PhotoSlider
                images={photos}
                visible={!!currentItem}
                index={index}
                onClose={handleClose}
                onIndexChange={handleIndexChange}
                toolbarRender={() => <PhotoViewerToolbar item={currentItem} />}
            />
        </PhotoViewerContext.Provider>
    );
}

const VideoPlayer = ({
    item,
    attrs
}: {
    item: CollectionGridItem;
    attrs: Partial<HTMLAttributes<HTMLElement>>;
}) => {
    const { currentItemId, videoRefMap } = useContext(PhotoViewerContext);
    const ref = useRef<HTMLVideoElement | null>(null);

    const CONTROL_SETTINGS_KEY = "holvi.videoControls";

    useEffect(() => {
        videoRefMap.set(item.id, ref);
    }, [item.id, ref, videoRefMap]);

    useEffect(() => {
        if (item.id !== currentItemId || !ref.current) {
            return;
        }
        ref.current.play();

        const json = localStorage.getItem(CONTROL_SETTINGS_KEY);
        if (!json) {
            return;
        }
        const { volume, isMuted } = JSON.parse(json);
        ref.current.volume = volume;
        ref.current.muted = isMuted;
    }, [item.id, currentItemId]);

    const handleVolumeChange = (
        e: React.SyntheticEvent<HTMLVideoElement, Event>
    ) => {
        const volume = (e.target as HTMLVideoElement).volume;
        const isMuted = (e.target as HTMLVideoElement).muted;
        localStorage.setItem(
            CONTROL_SETTINGS_KEY,
            JSON.stringify({ volume, isMuted })
        );
    };

    if (item.type !== "video") {
        return <div {...attrs}></div>;
    }

    return (
        <div
            style={{
                transform: "translate(-50%, -50%)",
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
            <video
                {...attrs}
                ref={ref}
                src={item.src}
                poster={item.thumbnailSrc}
                style={{
                    width: "100%",
                    height: "90dvh"
                }}
                controls
                loop
                onVolumeChange={handleVolumeChange}
                onKeyDown={(e) => e.stopPropagation()}
                controlsList="nodownload"
            />
        </div>
    );
};

const PhotoViewerToolbar = ({ item }: { item: CollectionGridItem | null }) => {
    if (!item) {
        return <></>;
    }

    return (
        <Flex direction="column" alignItems="end">
            <Box
                fontSize="sm"
                maxW={["12rem", "20rem", "25rem", "30rem"]}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                title={item.name}>
                {item.name}
            </Box>
            <Flex gap={2} fontSize="xs" textColor="whiteAlpha.600">
                <Box>
                    {item.type === "image" && item.gps && (
                        <Link
                            href={`https://www.google.com/maps/search/?api=1&query=${item.gps.lat},${item.gps.long}`}
                            target="_blank">
                            <Flex alignItems="center" gap={1}>
                                <Icon path={mdiMapMarker} size={0.5} />
                                <Box
                                    maxW={["6rem", "12rem", "30rem"]}
                                    whiteSpace="nowrap"
                                    overflow="hidden"
                                    textOverflow="ellipsis"
                                    title={item.gps.label || "Google Maps"}>
                                    {item.gps.label || "Google Maps"}
                                </Box>
                            </Flex>
                        </Link>
                    )}
                </Box>
                {item.type === "image" && item.gps && <span>|</span>}
                <Box whiteSpace="nowrap">{formatDate(item.timestamp)}</Box>
            </Flex>
        </Flex>
    );
};

function gridItemsToDataType(items: CollectionGridItem[]): DataType[] {
    return items
        .filter((item) => item.type !== "collection")
        .map((item) => ({
            key: item.id,
            src: item.type === "image" ? item.src : undefined,
            render:
                item.type === "video"
                    ? ({ attrs }) => <VideoPlayer item={item} attrs={attrs} />
                    : undefined
        }));
}
