import { useRef, useState } from "react";
import { sleep } from "../common/utilities";

const INTERVAL_MS = 500;

export function useRotatingThumbnail(thumbnailSources: string[]){
    const [index, setIndex] = useState(0);

    const thumbnailStoreRef = useRef({
        thumbnails: thumbnailSources[0] ? [thumbnailSources[0]] : [],
        initialized: false,
        running: false,
        timerId: -1
    });

    const start = () => {
        thumbnailStoreRef.current.running = true;
        initThumbnailStore();
        thumbnailTick();
    }

    const stopThumbnailTick = () => {
        thumbnailStoreRef.current.running = false;
        setIndex(0);
        window.clearInterval(thumbnailStoreRef.current.timerId);
    };

    const thumbnailTick = async () => {
        while (!thumbnailStoreRef.current.initialized) {
            await sleep(INTERVAL_MS);
        }
        if (!thumbnailStoreRef.current.running) {
            stopThumbnailTick();
            return;
        }
        thumbnailStoreRef.current.timerId = window.setTimeout(() => {
            setIndex((prev) =>
                prev + 1 >= thumbnailStoreRef.current.thumbnails.length
                    ? 0
                    : prev + 1
            );
            thumbnailTick();
        }, INTERVAL_MS);
    };

    const initThumbnailStore = async () => {
        if (thumbnailSources.length <= 1) {
            thumbnailStoreRef.current.initialized = true;
        }
        if (thumbnailStoreRef.current.initialized) {
            return;
        }
        const promises = thumbnailSources.slice(1).map((url) =>
            fetch(url)
                .then((res) => res.blob())
                .then((blob) =>
                    (window.URL || window.webkitURL).createObjectURL(blob)
                )
                .catch((error) =>
                    console.error(`Could not fetch thumbnail '${url}'`, error)
                )
        );
        const blobs = await Promise.all(promises);
        thumbnailStoreRef.current.thumbnails = [
            ...thumbnailStoreRef.current.thumbnails,
            ...blobs.filter((blob) => !!blob).map((blob) => blob as string)
        ];
        thumbnailStoreRef.current.initialized = true;
    };

    return {
        thumbnail: thumbnailStoreRef.current.thumbnails[index],
        startRotating: start,
        stopRotating: stopThumbnailTick
    }
}