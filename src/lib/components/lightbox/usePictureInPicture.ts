import { useEffect, useState } from "react";

export interface PictureInPicture {
    /** Whether the browser can play this video picture-in-picture */
    supported: boolean;
    /** Whether it is playing picture-in-picture now */
    active: boolean;
    toggle: () => void;
}

/**
 * Picture-in-picture for a video, where the browser supports it (not
 * Firefox, whose own picture-in-picture toggle has no API)
 */
export function usePictureInPicture(video: HTMLVideoElement): PictureInPicture {
    const supported =
        document.pictureInPictureEnabled === true &&
        !video.disablePictureInPicture;
    const [active, setActive] = useState(
        () => document.pictureInPictureElement === video
    );

    useEffect(() => {
        const update = () =>
            setActive(document.pictureInPictureElement === video);
        update();
        video.addEventListener("enterpictureinpicture", update);
        video.addEventListener("leavepictureinpicture", update);
        return () => {
            video.removeEventListener("enterpictureinpicture", update);
            video.removeEventListener("leavepictureinpicture", update);
        };
    }, [video]);

    const toggle = () => {
        // A refusal leaves the video where it is, which says enough
        if (document.pictureInPictureElement === video) {
            document.exitPictureInPicture().catch(() => undefined);
        } else {
            video.requestPictureInPicture().catch(() => undefined);
        }
    };

    return { supported, active, toggle };
}
