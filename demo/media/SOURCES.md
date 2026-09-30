# Sample media sources

The demo environment's sample media. Every file is prepared from an original on
Wikimedia Commons whose file page licenses it as CC0, the Creative Commons public
domain dedication (https://creativecommons.org/publicdomain/zero/1.0/), or as public
domain. Each row gives the licence and links the file page, which is where the
licence is stated. `demo/prepare-media.mjs` checks the licence on each file page (its
licence templates and the licence Commons reports for it) before it prepares anything,
downloads the originals and writes these files. Run it again to reproduce them:
`node demo/prepare-media.mjs`.

Licences last checked: 2026-09-30.

## Photos

Each original was downscaled once to at most 1600 px on the long edge (after applying its
EXIF orientation), converted to sRGB and saved as JPEG at quality 80 (mozjpeg). All of
the original's metadata was removed. The EXIF written in its place is chosen for the
demo, not the camera's: the taken date (DateTimeOriginal and DateTimeDigitized, which
have no time zone; Holvi reads them as UTC) is the date on the file page, with a made-up
time of day where the page gives none; GPS, on some photos only, is the location on the
file page unless noted; Artist is the author and Copyright the licence and file page.

| File | Size | Taken date written | GPS written | Source |
| --- | --- | --- | --- | --- |
| paella.jpg | 222 KiB | 2010-08-04 13:30:00 | none | [Cooking a paella.jpg](https://commons.wikimedia.org/wiki/File:Cooking_a_paella.jpg) by Jebulon (Own work), licence CC0 ({{self|Cc-zero}} on the file page) |
| buche-de-noel.jpg | 233 KiB | 2011-12-24 19:00:00 | none | [Bûche de Noël chocolat framboise maison.jpg](https://commons.wikimedia.org/wiki/File:B%C3%BBche_de_No%C3%ABl_chocolat_framboise_maison.jpg) by Jebulon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| chain-bridge-budapest-night.jpg | 214 KiB | 2013-06-20 22:47:56 | 47.496397, 19.040615 | [Széchenyi Chain Bridge in Budapest at night.jpg](https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg) by Wilfredor (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| flamingos-sao-paulo-zoo.jpg | 100 KiB | 2014-08-16 12:21:16 | -23.6505, -46.6197 (approximate: São Paulo Zoo; the file page has no location) | [Phoenicopterus ruber in São Paulo Zoo.jpg](https://commons.wikimedia.org/wiki/File:Phoenicopterus_ruber_in_S%C3%A3o_Paulo_Zoo.jpg) by Wilfredor (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| beach-parasols-evening.jpg | 380 KiB | 2014-07-31 20:15:00 | 36.713674, -4.275868 | [Parasols, Evening, Beach, Rincon de la Victoria, Andalusia, Spain.jpg](https://commons.wikimedia.org/wiki/File:Parasols,_Evening,_Beach,_Rincon_de_la_Victoria,_Andalusia,_Spain.jpg) by Jebulon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| water-lily-alhambra.jpg | 177 KiB | 2014-08-06 11:00:00 | 37.176911, -3.588466 | [Nymphaea alba, Alhambra, Granada, Spain.jpg](https://commons.wikimedia.org/wiki/File:Nymphaea_alba,_Alhambra,_Granada,_Spain.jpg) by Jebulon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| aegina-sunset.jpg | 218 KiB | 2015-10-27 16:40:28 | 37.745142, 23.426711 | [Aegina sunset.jpg](https://commons.wikimedia.org/wiki/File:Aegina_sunset.jpg) by Jebulon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| aegina-harbour-night.jpg | 99 KiB | 2015-10-27 19:30:00 | none | [Night view chapel harbour Aegina Greece.jpg](https://commons.wikimedia.org/wiki/File:Night_view_chapel_harbour_Aegina_Greece.jpg) by Jebulon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| cat-asleep-on-bench.jpg | 232 KiB | 2016-07-30 15:57:00 | none | [Chat domestique dormant sur un banc.jpg](https://commons.wikimedia.org/wiki/File:Chat_domestique_dormant_sur_un_banc.jpg) by GrandCelinien (Own work), licence CC0 ({{cc-zero}} on the file page) |
| dog-on-beach.jpg | 187 KiB | 2017-04-14 15:31:48 | 56.95923, 8.365443 | [Dog at Nørre Vorupør Strand.jpg](https://commons.wikimedia.org/wiki/File:Dog_at_N%C3%B8rre_Vorup%C3%B8r_Strand.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| beach-steps.jpg | 387 KiB | 2017-04-14 15:57:00 | none | [Wooden steps at Nørre Vorupør Strand.jpg](https://commons.wikimedia.org/wiki/File:Wooden_steps_at_N%C3%B8rre_Vorup%C3%B8r_Strand.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| beech-and-ferns.jpg | 423 KiB | 2017-06-09 13:43:44 | none | [Beech and ferns in Gullmarsskogen.jpg](https://commons.wikimedia.org/wiki/File:Beech_and_ferns_in_Gullmarsskogen.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| spruce-forest.jpg | 438 KiB | 2017-06-09 19:11:12 | 58.384771, 11.558511 | [Spruce forest at Holma.jpg](https://commons.wikimedia.org/wiki/File:Spruce_forest_at_Holma.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| rose-hips.jpg | 301 KiB | 2017-10-06 12:56:41 | none | [Rose hips in autumn.jpg](https://commons.wikimedia.org/wiki/File:Rose_hips_in_autumn.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| tabby-cat.jpg | 185 KiB | 2018-06-11 20:31:06 | none | [Young tabby cat keeping watch.jpg](https://commons.wikimedia.org/wiki/File:Young_tabby_cat_keeping_watch.jpg) by W.carter (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| horseshoe-falls.jpg | 204 KiB | 2018-09-28 17:14:10 | 43.0788664, -79.078299 | [Horseshoe-Falls-Zoom.jpg](https://commons.wikimedia.org/wiki/File:Horseshoe-Falls-Zoom.jpg) by Jchmrt (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| labrador.jpg | 183 KiB | 2019-07-20 18:17:36 | none | [Portrait of a labrador retriever.jpg](https://commons.wikimedia.org/wiki/File:Portrait_of_a_labrador_retriever.jpg) by Dktue (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| waterfall-glandieu.jpg | 569 KiB | 2019-10-07 17:42:50 | none | [Cascade de Glandieu, octobre 2019 (1).jpg](https://commons.wikimedia.org/wiki/File:Cascade_de_Glandieu,_octobre_2019_(1).jpg) by Benoît Prieur (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| snowy-trees.jpg | 427 KiB | 2021-01-17 08:52:19 | none | [Lots of trees with snow.jpg](https://commons.wikimedia.org/wiki/File:Lots_of_trees_with_snow.jpg) by Clump (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| marigolds.jpg | 266 KiB | 2022-07-09 12:07:59 | none | [Tagetes2.jpg](https://commons.wikimedia.org/wiki/File:Tagetes2.jpg) by The People's Internet (Own work), licence CC0 ({{cc-zero}} on the file page) |
| rio-sugarloaf-sunset.jpg | 189 KiB | 2023-06-03 14:08:17 | none | [Rio de Janeiro skyline and Sugarloaf Mountain at sunset, Brazil 3.jpg](https://commons.wikimedia.org/wiki/File:Rio_de_Janeiro_skyline_and_Sugarloaf_Mountain_at_sunset,_Brazil_3.jpg) by Wilfredor (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| lake-khovsgol.jpg | 369 KiB | 2023-06-27 16:00:00 | 50.535889, 100.391861 | [Lake Khövsgöl, Mongolia.jpg](https://commons.wikimedia.org/wiki/File:Lake_Kh%C3%B6vsg%C3%B6l,_Mongolia.jpg) by Bernard Gagnon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| lake-terkhiin-tsagaan.jpg | 188 KiB | 2023-06-30 10:30:00 | 48.166333, 99.76375 | [Terkhiin Tsagaan Lake 01.jpg](https://commons.wikimedia.org/wiki/File:Terkhiin_Tsagaan_Lake_01.jpg) by Bernard Gagnon (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| quebec-snow-fog.jpg | 344 KiB | 2023-12-06 10:27:17 | none | [Snow-covered Quebec City skyline in fog.jpg](https://commons.wikimedia.org/wiki/File:Snow-covered_Quebec_City_skyline_in_fog.jpg) by Wilfredor (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| quebec-autumn.jpg | 159 KiB | 2024-10-20 17:04:01 | none | [Autumn in Quebec City (in autumn 02).jpg](https://commons.wikimedia.org/wiki/File:Autumn_in_Quebec_City_(in_autumn_02).jpg) by Wilfredor (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| go-away-bird.jpg | 175 KiB | 2025-01-18 12:35:53 | none | [White-bellied go-away-bird (Corythaixoides leucogaster).jpg](https://commons.wikimedia.org/wiki/File:White-bellied_go-away-bird_(Corythaixoides_leucogaster).jpg) by Hobbyfotowiki (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| monschau-autumn.jpg | 502 KiB | 2025-10-18 14:11:14 | 50.554374, 6.241492 | [Along the Rur, autumn in Monschau, 2025.jpg](https://commons.wikimedia.org/wiki/File:Along_the_Rur,_autumn_in_Monschau,_2025.jpg) by DimiTalen (Own work), licence CC0 ({{self|cc-zero}} on the file page) |
| red-fox-in-snow.jpg | 289 KiB | 2025-12-26 13:04:38 | none | [Red fox in yard, Charlton MA 2025-12-26.jpg](https://commons.wikimedia.org/wiki/File:Red_fox_in_yard,_Charlton_MA_2025-12-26.jpg) by Peter Cooper Jr. (Own work), licence CC0 ({{self|cc-zero}} on the file page) |

## Videos

Each clip is 3 seconds cut from the original, from the start time given,
at the original's resolution and frame rate, without the original's metadata. It is
encoded twice, with its creation_time metadata set to the date on the file page and
a made-up time of day:

- `.mp4`: H.264 (High profile, yuv420p, CRF 26) with AAC stereo audio, moov atom at the front. Web-safe, so video processing makes no Rendition.
- `.mov`: HEVC (yuv420p, CRF 30, tagged hvc1 like Apple devices) with AAC stereo audio in QuickTime MOV. Not web-safe, so video processing makes a Rendition.

| File | Size | Codecs and container | Duration | creation_time | Source |
| --- | --- | --- | --- | --- | --- |
| sea-foam.mp4 | 1563 KiB | h264 + aac, MP4, 1280x720 | 3.00 s | 2015-08-25T18:42:10Z | [Sea Foam off Amphitrite Point near Ucluelet.webm](https://commons.wikimedia.org/wiki/File:Sea_Foam_off_Amphitrite_Point_near_Ucluelet.webm) by Extemporalist (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 8 s |
| sea-foam.mov | 784 KiB | hevc + aac, MOV, 1280x720 | 3.00 s | 2015-08-25T18:42:10Z | [Sea Foam off Amphitrite Point near Ucluelet.webm](https://commons.wikimedia.org/wiki/File:Sea_Foam_off_Amphitrite_Point_near_Ucluelet.webm) by Extemporalist (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 8 s |
| loons.mp4 | 1378 KiB | h264 + aac, MP4, 1280x720 | 3.00 s | 2015-08-03T14:05:30Z | [Loons Swimming in Wood Lake BC on a Summer Morning.webm](https://commons.wikimedia.org/wiki/File:Loons_Swimming_in_Wood_Lake_BC_on_a_Summer_Morning.webm) by Extemporalist (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 4 s |
| loons.mov | 806 KiB | hevc + aac, MOV, 1280x720 | 3.00 s | 2015-08-03T14:05:30Z | [Loons Swimming in Wood Lake BC on a Summer Morning.webm](https://commons.wikimedia.org/wiki/File:Loons_Swimming_in_Wood_Lake_BC_on_a_Summer_Morning.webm) by Extemporalist (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 4 s |
| waterfall-vertical.mp4 | 1957 KiB | h264 + aac, MP4, 720x1280 | 3.00 s | 2025-11-12T03:20:45Z | [Watagataki Falls (Video).webm](https://commons.wikimedia.org/wiki/File:Watagataki_Falls_(Video).webm) by Yoshi Canopus (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 3 s |
| waterfall-vertical.mov | 1347 KiB | hevc + aac, MOV, 720x1280 | 3.00 s | 2025-11-12T03:20:45Z | [Watagataki Falls (Video).webm](https://commons.wikimedia.org/wiki/File:Watagataki_Falls_(Video).webm) by Yoshi Canopus (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 3 s |

## Broken video

`broken-audio.mp4` is made like the `.mp4` clips, and then its audio track's codec is changed
to one no decoder knows (the sample entry's fourcc `mp4a` becomes `xxxx`, and the object
type in its decoder config, 0x40 for AAC, becomes 0xfe). Upload accepts it, since its
metadata and thumbnail need only the video track. Video processing fails on it: its
audio is not AAC, so it needs a Rendition, and making one needs the audio decoded, so it
ends up failed with ffmpeg's `Decoder (codec none) not found for input stream #0:1`.

| File | Size | Codecs and container | Duration | creation_time | Source |
| --- | --- | --- | --- | --- | --- |
| broken-audio.mp4 | 1203 KiB | h264 + unknown audio codec (xxxx), MP4, 1280x720 | 3.00 s | 2015-08-03T14:12:00Z | [Loons Swimming in Wood Lake BC on a Summer Morning.webm](https://commons.wikimedia.org/wiki/File:Loons_Swimming_in_Wood_Lake_BC_on_a_Summer_Morning.webm) by Extemporalist (Own work), licence CC0 ({{self|cc-zero}} on the file page), from 20 s |
