# Renditions sit beside originals, which video processing never modifies

Some videos, such as HEVC from iPhones, cannot play in some browsers. Instead of converting originals, video processing adds a Rendition for any video whose original is not web-safe. A web-safe original is H.264 (8-bit 4:2:0) with AAC or no audio, in MP4. The Rendition is an H.264/AAC MP4 at the original resolution with a capped bitrate, or a remux when only the container is wrong. It is encrypted and stored next to the original. Web-safe originals are served as they are and never re-encoded, whatever their bitrate. Backups contain originals only.

## Considered Options

- **Converting originals in place**: cannot be undone, loses fidelity, and a Backup would no longer be a faithful copy of what the user uploaded.
- **A Rendition for every video**: wastes space and lowers quality for videos that already play everywhere.
- **Transcoding on the fly while streaming**: too much CPU for a self-hosted box, and seeking becomes unreliable.
- **Adaptive streaming (HLS/DASH)**: far more complexity than a personal vault needs.

## Consequences

- Non-web-safe videos take extra storage.
- High-bitrate web-safe originals may stutter on slow connections. Capping them is a possible follow-up.
- The existing upload-time conversion of AVI originals to MOV is older behaviour, is out of scope here, and stays unchanged.
