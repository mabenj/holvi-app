import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import {
    mdiPause,
    mdiPlay,
    mdiVolumeHigh,
    mdiVolumeMedium,
    mdiVolumeOff
} from "@mdi/js";
import Icon from "@mdi/react";
import type PhotoSwipe from "photoswipe";
import { useEffect, useRef, useState } from "react";
import {
    setControlsVisible,
    TAPPABLE_WHILE_VISIBLE,
    useControlsVisible
} from "./lightbox-controls";
import PlayerSlider from "./PlayerSlider";
import { CONTROLS_AUTO_HIDE_MS, formatPlaybackTime } from "./video-player";
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
}

/**
 * The active video's controls: play and pause, position and duration, a
 * progress bar to scrub with, and volume or mute. They show and hide with
 * the rest of the lightbox's controls, and hide by themselves once playback
 * has run for a few seconds.
 */
export default function VideoControls({
    pswp,
    video,
    knownDuration
}: VideoControlsProps) {
    const playback = useVideoPlayback(video);
    const visible = useControlsVisible(pswp);
    const canSetVolume = useMediaQuery(FINE_POINTER_QUERY, false);

    const duration = Number.isFinite(playback.duration)
        ? playback.duration
        : (knownDuration ?? NaN);

    const [scrubTime, setScrubTime] = useState<number | null>(null);
    const resumeAfterScrub = useRef(false);
    const [hovered, setHovered] = useState(false);
    // Changes on each interaction, so the auto-hide countdown starts over
    const [lastInteraction, setLastInteraction] = useState(0);

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

    const togglePlay = () => {
        if (video.paused || video.ended) {
            play();
        } else {
            video.pause();
        }
    };

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
    const position = formatPlaybackTime(shownTime);
    const length = formatPlaybackTime(duration);

    return (
        <Box
            css={TAPPABLE_WHILE_VISIBLE}
            onPointerDown={(event) => setLastInteraction(event.timeStamp)}
            onPointerEnter={(event) =>
                event.pointerType === "mouse" && setHovered(true)
            }
            onPointerLeave={() => setHovered(false)}>
            <Flex alignItems="center">
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
                    onClick={togglePlay}
                />
                <Text
                    fontSize="sm"
                    fontVariantNumeric="tabular-nums"
                    whiteSpace="nowrap">
                    {position} / {length}
                </Text>
                <Box flex="1" />
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
                            onChange={(volume) => {
                                video.volume = volume;
                                video.muted = volume === 0;
                            }}
                        />
                    </Flex>
                )}
            </Flex>
        </Box>
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
    onClick
}: {
    label: string;
    icon: string;
    onClick: () => void;
}) {
    return (
        <IconButton
            aria-label={label}
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
