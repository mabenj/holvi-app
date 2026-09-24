import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { ScrubPreview } from "@/lib/types/scrub-preview";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import {
    mdiPause,
    mdiPictureInPictureBottomRight,
    mdiPictureInPictureBottomRightOutline,
    mdiPlay,
    mdiRepeat,
    mdiRepeatOff,
    mdiVolumeHigh,
    mdiVolumeMedium,
    mdiVolumeOff
} from "@mdi/js";
import Icon from "@mdi/react";
import type PhotoSwipe from "photoswipe";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    setControlsVisible,
    TAPPABLE_WHILE_VISIBLE,
    useControlsVisible
} from "./lightbox-controls";
import PlayerSlider from "./PlayerSlider";
import ScrubPreviewFrame, {
    usePreloadedScrubPreview
} from "./ScrubPreviewFrame";
import SkipCue from "./SkipCue";
import { usePictureInPicture } from "./usePictureInPicture";
import { useDoubleTapSkip, useKeyboardControls } from "./usePlayerShortcuts";
import {
    CONTROLS_AUTO_HIDE_MS,
    formatPlaybackTime,
    progressPreview,
    setVolume,
    SkipDirection,
    togglePlay
} from "./video-player";
import { useVideoPlayback } from "./useVideoPlayback";

// Volume can be set only where there is a mouse: phones use their hardware
// buttons, and iOS ignores the setting
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

interface VideoControlsProps {
    pswp: PhotoSwipe;
    /** The active slide's video */
    video: HTMLVideoElement;
    /** Seconds, from the file's metadata, until the video knows its own */
    knownDuration?: number;
    /**
     * Shows the frame being scrubbed to or hovered over, if video processing
     * has made one
     */
    scrubPreview?: ScrubPreview;
}

/**
 * The active video's controls: play and pause, position and duration, a
 * progress bar to scrub with (showing the frame being scrubbed to from the
 * video's Scrub preview, if it has one, and previewing the frame and time
 * under a hovering mouse without seeking), loop, picture-in-picture where the
 * browser supports it, and volume or mute. They show and hide with the rest
 * of the lightbox's controls, and hide by themselves once playback has run
 * for a few seconds.
 *
 * Double-tapping the video's left or right third skips, with a cue, and the
 * keyboard controls the video while it is the active slide.
 */
export default function VideoControls({
    pswp,
    video,
    knownDuration,
    scrubPreview
}: VideoControlsProps) {
    const playback = useVideoPlayback(video);
    usePreloadedScrubPreview(scrubPreview);
    const visible = useControlsVisible(pswp);
    const canSetVolume = useMediaQuery(FINE_POINTER_QUERY, false);

    const duration = Number.isFinite(playback.duration)
        ? playback.duration
        : (knownDuration ?? NaN);

    const [scrubTime, setScrubTime] = useState<number | null>(null);
    const resumeAfterScrub = useRef(false);
    // Where a mouse hovers over the progress bar, from 0 to 1
    const [hoverFraction, setHoverFraction] = useState<number | null>(null);
    const [hovered, setHovered] = useState(false);
    // Changes on each interaction, so the auto-hide countdown starts over
    const [lastInteraction, setLastInteraction] = useState(0);
    const [loop, setLoop] = useState(video.loop);
    const pictureInPicture = usePictureInPicture(video);
    // Each skip gets a new cue, so its ripple starts over
    const [skip, setSkip] = useState<{
        direction: SkipDirection;
        id: number;
    } | null>(null);

    useDoubleTapSkip(pswp, video, (direction) =>
        setSkip((previous) => ({ direction, id: (previous?.id ?? 0) + 1 }))
    );
    // A key shows the controls, so the viewer sees what it did
    useKeyboardControls(pswp, video, () => {
        setControlsVisible(pswp, true);
        setLastInteraction(performance.now());
    });

    const playing = !playback.paused;
    const holding = scrubTime !== null || hovered;
    useEffect(() => {
        if (!visible || !playing || holding) return;
        const timer = setTimeout(
            () => setControlsVisible(pswp, false),
            CONTROLS_AUTO_HIDE_MS
        );
        return () => clearTimeout(timer);
    }, [pswp, visible, playing, holding, lastInteraction]);

    // Show the controls again once the video has finished
    useEffect(() => {
        if (playback.ended) setControlsVisible(pswp, true);
    }, [pswp, playback.ended]);

    // A mouse moving over the lightbox shows them, as in other players
    useEffect(() => {
        const root = pswp.element;
        if (!root) return;
        const onMove = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            setControlsVisible(pswp, true);
            setLastInteraction(event.timeStamp);
        };
        root.addEventListener("pointermove", onMove);
        return () => root.removeEventListener("pointermove", onMove);
    }, [pswp]);

    // A refused play leaves the play button showing, which says enough
    const play = () => video.play().catch(() => undefined);

    const seekTo = (fraction: number) => {
        if (!Number.isFinite(duration)) return;
        const time = fraction * duration;
        setScrubTime(time);
        video.currentTime = time;
    };

    const shownTime = scrubTime ?? playback.currentTime;
    const progress =
        Number.isFinite(duration) && duration > 0
            ? Math.min(1, shownTime / duration)
            : 0;
    const silent = playback.muted || playback.volume === 0;
    const audibleVolume = silent ? 0 : playback.volume;
    const preview = progressPreview({
        duration,
        hasScrubPreview: scrubPreview !== undefined,
        dragTime: scrubTime,
        hoverFraction
    });
    const position = formatPlaybackTime(shownTime);
    const length = formatPlaybackTime(duration);

    return (
        <>
            {skip &&
                pswp.element &&
                createPortal(
                    <SkipCue key={skip.id} direction={skip.direction} />,
                    pswp.element
                )}
            <Box
                css={TAPPABLE_WHILE_VISIBLE}
                onPointerDown={(event) => setLastInteraction(event.timeStamp)}
                onPointerEnter={(event) =>
                    event.pointerType === "mouse" && setHovered(true)
                }
                onPointerLeave={() => setHovered(false)}>
                <Flex alignItems="center" position="relative">
                    {preview && (
                        <ScrubPreviewFrame
                            preview={scrubPreview}
                            time={preview.time}
                            progress={preview.fraction}
                        />
                    )}
                    <PlayerSlider
                        label="Seek"
                        value={progress}
                        valueText={`${position} of ${length}`}
                        onDragStart={() => {
                            // Paused while scrubbing, so the frames follow the pointer
                            resumeAfterScrub.current = !video.paused;
                            video.pause();
                        }}
                        onChange={seekTo}
                        onHover={setHoverFraction}
                        onDragEnd={() => {
                            setScrubTime(null);
                            if (resumeAfterScrub.current) {
                                play();
                            }
                        }}
                    />
                </Flex>
                <Flex alignItems="center" gap="1" ml="-2">
                    <ControlButton
                        label={playing ? "Pause" : "Play"}
                        icon={playing ? mdiPause : mdiPlay}
                        onClick={() => togglePlay(video)}
                    />
                    <Text
                        fontSize="sm"
                        fontVariantNumeric="tabular-nums"
                        whiteSpace="nowrap">
                        {position} / {length}
                    </Text>
                    <Box flex="1" />
                    <ControlButton
                        label={loop ? "Turn off loop" : "Loop"}
                        icon={loop ? mdiRepeat : mdiRepeatOff}
                        pressed={loop}
                        onClick={() => {
                            video.loop = !loop;
                            setLoop(!loop);
                        }}
                    />
                    {pictureInPicture.supported && (
                        <ControlButton
                            label={
                                pictureInPicture.active
                                    ? "Exit picture-in-picture"
                                    : "Picture-in-picture"
                            }
                            icon={
                                pictureInPicture.active
                                    ? mdiPictureInPictureBottomRight
                                    : mdiPictureInPictureBottomRightOutline
                            }
                            pressed={pictureInPicture.active}
                            onClick={pictureInPicture.toggle}
                        />
                    )}
                    <ControlButton
                        label={silent ? "Unmute" : "Mute"}
                        icon={volumeIcon(audibleVolume)}
                        onClick={() => {
                            if (silent && playback.volume === 0) {
                                video.volume = 1;
                            }
                            video.muted = !silent;
                        }}
                    />
                    {canSetVolume && (
                        <Flex w="24" mr="2">
                            <PlayerSlider
                                label="Volume"
                                value={audibleVolume}
                                valueText={`${Math.round(audibleVolume * 100)}%`}
                                onChange={(volume) => setVolume(video, volume)}
                            />
                        </Flex>
                    )}
                </Flex>
            </Box>
        </>
    );
}

function volumeIcon(audibleVolume: number) {
    if (audibleVolume === 0) return mdiVolumeOff;
    return audibleVolume < 0.5 ? mdiVolumeMedium : mdiVolumeHigh;
}

/** A round, icon-only button in the video controls */
function ControlButton({
    label,
    icon,
    pressed,
    onClick
}: {
    label: string;
    icon: string;
    /** For a toggle, whether it is on */
    pressed?: boolean;
    onClick: () => void;
}) {
    return (
        <IconButton
            aria-label={label}
            aria-pressed={pressed}
            // A mouse press leaves focus where it was, so space goes on
            // toggling play instead of pressing this button again
            onMouseDown={(event) => event.preventDefault()}
            title={label}
            variant="ghost"
            color="white"
            rounded="full"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={onClick}>
            <Icon path={icon} size="28px" aria-hidden />
        </IconButton>
    );
}
