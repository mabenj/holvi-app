import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
import { Alert, AlertIcon } from "@chakra-ui/react";
import { atom, useAtom } from "jotai";
import React, { HTMLAttributes, useEffect, useState } from "react";
import { PhotoSlider } from "react-photo-view";
import { DataType } from "react-photo-view/dist/types";
import PhotoViewerToolbar from "./PhotoViewerToolbar";

const photoViewerActiveId = atom<string | null>(null);

interface PhotoViewerProps {
    items: CollectionGridItem[];
}

export default function PhotoViewer({ items }: PhotoViewerProps) {
    const [photos, setPhotos] = useState([] as DataType[]);
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const [activeItemId, setActiveItemId] = useAtom(photoViewerActiveId);

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
        setIsVisible(activeItemId ? true : false);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItemId]);

    const handleIndexChange = (index: number) => {
        const itemId = photos[index]?.key?.toString() || null;
        setActiveItemId(itemId);
        setIndex(index);
    };

    return (
        <PhotoSlider
            images={photos}
            visible={isVisible}
            onClose={() => setIsVisible(false)}
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
    // TODO check these:
    // https://github.com/CookPete/react-player
    // https://github.com/sampotts/plyr

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
                src={item.src}
                poster={item.thumbnailSrc}
                style={{
                    width: "100%",
                    height: "90dvh"
                }}
                controls
            />
        </div>
    );
};
