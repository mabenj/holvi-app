import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { Alert, AlertIcon } from "@chakra-ui/react";
import { atom, useAtom } from "jotai";
import React, { HTMLAttributes, useEffect, useRef, useState } from "react";
import { PhotoSlider } from "react-photo-view";
import { DataType } from "react-photo-view/dist/types";
import PhotoViewerToolbar from "./PhotoViewerToolbar";

const photoViewerActiveId = atom<string | null>(null);
const photoViewerVideoRefMap = atom(
    new Map<string, React.MutableRefObject<HTMLVideoElement | null>>()
);

interface PhotoViewerProps {
    items: CollectionGridItem[];
}

export default function PhotoViewer({ items }: PhotoViewerProps) {
    const [photos, setPhotos] = useState([] as DataType[]);
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const [activeItemId, setActiveItemId] = useAtom(photoViewerActiveId);
    const [videoRefMap] = useAtom(photoViewerVideoRefMap);

    useEffect(() => {
        const nextPhotos: DataType[] = items
            .filter((item) => item.type !== "collection")
            .map((item) => ({
                key: item.id,
                src: item.type === "image" ? item.src : undefined,
                render:
                    item.type === "video"
                        ? ({ attrs }) => (
                              <VideoPlayer item={item} attrs={attrs} />
                          )
                        : undefined
            }));
        setPhotos(nextPhotos);
        setActiveItemId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    useEffect(() => {
        const itemIndex = photos.findIndex(
            (photo) => photo.key === activeItemId
        );
        setIndex(Math.max(itemIndex, 0));
        setIsVisible(!!activeItemId);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItemId]);

    const handleIndexChange = (index: number) => {
        pauseActiveVideo();
        const itemId = photos[index]?.key?.toString() || null;
        setActiveItemId(itemId);
        setIndex(index);
    };

    const handleClose = () => {
        pauseActiveVideo();
        setIsVisible(false);
        setActiveItemId(null);
    };

    const pauseActiveVideo = () => {
        if (!activeItemId) {
            return;
        }
        const videoRef = videoRefMap.get(activeItemId);
        videoRef?.current?.pause();
    };

    return (
        <PhotoSlider
            images={photos}
            visible={isVisible}
            onClose={handleClose}
            index={index}
            onIndexChange={handleIndexChange}
            toolbarRender={() => (
                <PhotoViewerToolbar
                    item={items.find((item) => item.id === activeItemId)}
                />
            )}
        />
    );
}

export const Photo = ({
    children,
    id
}: {
    children: React.ReactNode;
    id: string;
}) => {
    const [, setActiveItemId] = useAtom(photoViewerActiveId);

    return <div onClick={() => setActiveItemId(id)}>{children}</div>;
};

const VideoPlayer = ({
    item,
    attrs
}: {
    item: CollectionGridItem;
    attrs: Partial<HTMLAttributes<HTMLElement>>;
}) => {
    const [activeItemId] = useAtom(photoViewerActiveId);
    const [, setPhotoViewerVideoRefMap] = useAtom(photoViewerVideoRefMap);
    const ref = useRef<HTMLVideoElement | null>(null);

    const CONTROL_SETTINGS_KEY = "holvi.videoControls";

    useEffect(() => {
        setPhotoViewerVideoRefMap((prev) => {
            prev.set(item.id, ref);
            return prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id, ref]);

    useEffect(() => {
        if (item.id !== activeItemId || !ref.current) {
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
    }, [item.id, activeItemId]);

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
        return (
            <div {...attrs}>
                <Alert status="error">
                    <AlertIcon />
                    Invalid video!
                </Alert>
            </div>
        );
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
            />
        </div>
    );
};
