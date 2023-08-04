import { formatDate } from "@/lib/common/utilities";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { useRouter } from "next/router";
import PhotoSwipe from "photoswipe";
import { createContext, useContext, useEffect, useRef } from "react";
import { Gallery, Item, useGallery } from "react-photoswipe-gallery";
import CollectionGridCard from "../collection-grid/CollectionGridCard";

interface LightboxContext {
    activeId: string | null;
    videoRefMap: Map<string, React.MutableRefObject<HTMLVideoElement | null>>;
}

const LightboxContext = createContext<LightboxContext>({
    activeId: null,
    videoRefMap: new Map()
});

interface LightboxGalleryProps {
    items: CollectionGridItem[];
}

export default function LightboxGallery({ items }: LightboxGalleryProps) {
    const router = useRouter();
    const { photoId } = router.query as { photoId?: string };

    const pswpRef = useRef<PhotoSwipe>();
    const videoRefMap = useRef(
        new Map<string, React.MutableRefObject<HTMLVideoElement | null>>()
    );

    const setPswpInstance = (pswpInstance: PhotoSwipe) => {
        pswpInstance.on("close", handleClose);
        pswpInstance.on("change", () =>
            handleChangeIndex(pswpInstance.currIndex)
        );
        pswpRef.current = pswpInstance;
    };

    const handleClose = () => {
        pauseActiveVideo();
        pswpRef.current?.close();

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

    const handleChangeIndex = (index: number) => {
        pauseActiveVideo();
        const itemId = items[index].id;

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

    const pauseActiveVideo = () => {
        if (!photoId) {
            return;
        }
        const videoRef = videoRefMap.current.get(photoId);
        videoRef?.current?.pause();
    };

    return (
        <LightboxContext.Provider
            value={{
                activeId: photoId || null,
                videoRefMap: videoRefMap.current
            }}>
            <Gallery
                onOpen={setPswpInstance}
                options={{
                    bgOpacity: 1,
                    wheelToZoom: true,
                    clickToCloseNonZoomable: false
                }}
                withCaption>
                <GalleryContent
                    items={items}
                    activeId={photoId || null}
                    onClose={() => pswpRef.current?.close()}
                />
            </Gallery>
        </LightboxContext.Provider>
    );
}

const GalleryContent = ({
    items,
    activeId,
    onClose
}: {
    items: CollectionGridItem[];
    activeId: string | null;
    onClose: () => void;
}) => {
    const { open } = useGallery();

    useEffect(() => {
        const index = items.findIndex((item) => item.id === activeId);
        if (index === -1) {
            return onClose();
        }
        open(index);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    return (
        <>
            {items.map((item) => (
                <GalleryItem key={item.id} item={item} />
            ))}
        </>
    );
};

const GalleryItem = ({ item }: { item: CollectionGridItem }) => {
    if (item.type === "collection") {
        return <CollectionGridCard item={item} />;
    }

    return (
        <Item
            original={item.type === "image" ? item.src : undefined}
            thumbnail={item.thumbnailSrc}
            width={item.type === "image" ? item.width : undefined}
            height={item.type === "image" ? item.height : undefined}
            caption={getCaption(item)}
            content={
                item.type === "image" ? undefined : <VideoPlayer item={item} />
            }
            cropped>
            {({ ref }) => (
                <CollectionGridCard
                    item={item}
                    imageRef={ref as React.MutableRefObject<HTMLImageElement>}
                />
            )}
        </Item>
    );
};

const VideoPlayer = ({ item }: { item: CollectionGridItem }) => {
    const { activeId, videoRefMap } = useContext(LightboxContext);
    const ref = useRef<HTMLVideoElement | null>(null);

    const CONTROL_SETTINGS_KEY = "holvi.videoControls";

    useEffect(() => {
        videoRefMap.set(item.id, ref);
    }, [item.id, ref, videoRefMap]);

    useEffect(() => {
        if (item.id !== activeId || !ref.current) {
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
    }, [item.id, activeId]);

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
        return <span>Not a video</span>;
    }

    return (
        <video
            ref={ref}
            src={item.src}
            poster={item.thumbnailSrc}
            style={{
                width: "100%",
                height: "95dvh"
            }}
            controls
            loop
            onVolumeChange={handleVolumeChange}
            onKeyDown={(e) => e.stopPropagation()}
            controlsList="nodownload"
        />
    );
};

function getCaption(item: CollectionGridItem): string {
    const WORLD_MAP = "🗺️";
    const LOCATION_PIN = "📍";
    const LINK = "🔗";

    let locationA = "";
    if (item.type === "image" && item.gps) {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.gps.lat},${item.gps.long}`;
        locationA = `<a href='${mapsUrl}' target='_blank' rel='noreferrer'>
                        <div 
                            class='caption-gps-link'
                            title='${item.gps.label || "Google Maps"}'
                        >
                            ${item.gps.label || "Google Maps"}
                        </div>
                    </a>`;
    }

    return `<div class='caption-wrapper'>
                <!--<div class='caption-filename' title='${item.name}'>
                    ${item.name}
                    </div>-->
                ${locationA}
                <div class='caption-date' title='${item.name}'>
                    ${formatDate(item.timestamp)}
                </div>
            </div>`;
}
