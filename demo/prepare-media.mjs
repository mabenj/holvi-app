// Prepares the demo environment's sample media in demo/media from CC0 originals
// on Wikimedia Commons, and writes demo/media/SOURCES.md to record them.
//
//     node demo/prepare-media.mjs
//
// Needs network access and the repo's dependencies (yarn install). Nothing is
// cached on disk: each original is downloaded into memory and only the
// prepared file is written. The prepared files are committed, so this only
// needs running again to change the set.
//
// Every file's licence is checked on its Commons file page first, and the
// script stops if one is not CC0 or public domain. The files are prepared in a
// staging directory that replaces demo/media only once all of them are ready.

import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { promisify } from "util";

const run = promisify(execFile);

const DEMO_DIR = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(DEMO_DIR, "media");
const STAGING_DIR = path.join(DEMO_DIR, "media.partial");
/** Commons asks every client for a descriptive User-Agent with a way to reach its maintainer */
const USER_AGENT = "HolviDemoMediaPrep/1.0 (https://github.com/mabenj/holvi-app; demo sample media)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Photos are downscaled so their long edge is at most this, in pixels */
const PHOTO_LONG_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 80;
const CLIP_SECONDS = 3;
const H264_CRF = 26;
const HEVC_CRF = 30;
/** The broken video's audio sample entry gets this fourcc in place of mp4a */
const UNKNOWN_FOURCC = "xxxx";
/** The MPEG-4 object type of AAC, which the broken video's decoder config loses */
const AAC_OBJECT_TYPE = 0x40;
/** An MPEG-4 object type no decoder is registered for */
const UNKNOWN_OBJECT_TYPE = 0xfe;

/**
 * The photos. `takenAt` is written as the EXIF taken date (DateTimeOriginal),
 * a camera's local time without a time zone. It is the date the file page
 * gives, with a made-up time of day where the page gives none. `gps` is
 * written as EXIF GPS; it comes from the file page's location template unless
 * `gpsNote` says otherwise. Photos without `gps` deliberately have none.
 */
const PHOTOS = [
    { name: "cruiser-butterfly.jpg", title: "File:Cruiser Butterfly (17414789383).jpg", takenAt: "2005-09-14 15:32:00" },
    { name: "danish-coast.jpg", title: "File:Danish coast.JPG", takenAt: "2008-10-25 14:37:05" },
    { name: "beach-near-otaru.jpg", title: "File:Beach near Otaru.jpg", takenAt: "2009-08-15 18:19:00" },
    { name: "photo-of-dutch-winter.jpg", title: "File:2010.01 - 'Photo of Dutch Winter nature', Dutch snow-landscape in the dunes , winter of 2010; Nature photography in the Netherlands by Fons Heijnsbroek, in the public domain; geotagged landscape picture in The Netherlands (27114819613).jpg", takenAt: "2010-01-07 15:57:00", gps: { latitude: 52.357151, longitude: 4.569282 } },
    { name: "rideau-river-ottawa-canada.jpg", title: "File:Rideau river Ottawa Canada.jpg", takenAt: "2010-06-25 23:58:52" },
    { name: "paella.jpg", title: "File:Cooking a paella.jpg", takenAt: "2010-08-04 13:30:00" },
    { name: "bunch-tulip-paris.jpg", title: "File:Bunch tulip Paris 2011.jpg", takenAt: "2011-02-13 16:48:00", gps: { latitude: 48.844056, longitude: 2.352389 } },
    { name: "suzuka-mountains-from-mount.jpg", title: "File:Suzuka Mountains from Mount Fujiwara 2011-02-19.jpg", takenAt: "2011-02-19 13:15:00" },
    { name: "church-of-the-virgin.jpg", title: "File:Church of the virgin of the burgh Rhodes 14th century night.jpg", takenAt: "2011-04-15 14:33:00", gps: { latitude: 36.442861, longitude: 28.230806 } },
    { name: "blueberries-in-pack.jpg", title: "File:Blueberries-In-Pack.jpg", takenAt: "2011-07-27 09:23:00" },
    { name: "abondance-louis-petitot-pont.jpg", title: "File:Abondance Louis Petitot Pont Carrousel Paris-CN.jpg", takenAt: "2011-12-17 09:11:00" },
    { name: "buche-de-noel.jpg", title: "File:Bûche de Noël chocolat framboise maison.jpg", takenAt: "2011-12-24 19:00:00" },
    { name: "grenade-albayzin-depuis-alhambra.jpg", title: "File:Grenade Albayzin depuis Alhambra Espagne.jpg", takenAt: "2012-08-14 10:53:08", gps: { latitude: 37.177313, longitude: -3.592068 } },
    { name: "ja1271-crossing-the-otaki.jpg", title: "File:JA1271 crossing the Otaki River.jpg", takenAt: "2012-09-22 10:22:00", gps: { latitude: -40.771957, longitude: 175.144543 } },
    { name: "mountain-and-landscape.jpg", title: "File:Mountain and Landscape.jpg", takenAt: "2013-01-31 20:56:38" },
    { name: "hong-kong-skyscrapers.jpg", title: "File:Hong Kong skyscrapers in a night of typhoon.jpg", takenAt: "2013-06-16 20:19:21" },
    { name: "chain-bridge-budapest-night.jpg", title: "File:Széchenyi Chain Bridge in Budapest at night.jpg", takenAt: "2013-06-20 22:47:56", gps: { latitude: 47.496397, longitude: 19.040615 } },
    { name: "general-rafael-urdaneta-bridge.jpg", title: "File:General Rafael Urdaneta Bridge view from the lake to Cabimas side.jpg", takenAt: "2013-08-05 20:19:28", gps: { latitude: 10.574011, longitude: -71.605216 } },
    { name: "hong-kong-park.jpg", title: "File:Hong Kong Park 44.jpg", takenAt: "2013-08-06 00:48:51" },
    { name: "victoria-harbour-skyscrapers.jpg", title: "File:Victoria Harbour skyscrapers.jpg", takenAt: "2013-08-08 07:22:53" },
    { name: "juan-griego-sunset.jpg", title: "File:Juan Griego Sunset.jpg", takenAt: "2014-04-21 17:45:17", gps: { latitude: 11.08048, longitude: -63.973695 } },
    { name: "beached-wooden-fishing-boat.jpg", title: "File:Beached wooden fishing boat leaning beside the lagoon at Chacachacare, Margarita Island, Venezuela.jpg", takenAt: "2014-04-22 08:55:05", gps: { latitude: 10.924392, longitude: -64.117305 } },
    { name: "fishing-boat-aground.jpg", title: "File:A day of fishing aground.jpg", takenAt: "2014-04-22 08:55:20", gps: { latitude: 10.924467, longitude: -64.117307 } },
    { name: "fishermen-with-his-son.jpg", title: "File:Fishermen with his son on Pier Juan Griego.jpg", takenAt: "2014-04-24 17:14:26", gps: { latitude: 11.08048, longitude: -63.973695 } },
    { name: "punta-di-a-coscia.jpg", title: "File:Punta di a Coscia, Macinaggio, Rogliano, Corsica.jpg", takenAt: "2014-05-10 21:20:09", gps: { latitude: 42.9667, longitude: 9.4246 } },
    { name: "beach-parasols-evening.jpg", title: "File:Parasols, Evening, Beach, Rincon de la Victoria, Andalusia, Spain.jpg", takenAt: "2014-07-31 20:15:00", gps: { latitude: 36.713674, longitude: -4.275868 } },
    { name: "fishing-boats-morning-beach.jpg", title: "File:Fishing boats, morning, Beach, Rincon de la Victoria, Andalusia, Spain.jpg", takenAt: "2014-08-01 12:47:00", gps: { latitude: 36.713445, longitude: -4.27731 } },
    { name: "water-lily-alhambra.jpg", title: "File:Nymphaea alba, Alhambra, Granada, Spain.jpg", takenAt: "2014-08-06 11:00:00", gps: { latitude: 37.176911, longitude: -3.588466 } },
    { name: "flamingos-sao-paulo-zoo.jpg", title: "File:Phoenicopterus ruber in São Paulo Zoo.jpg", takenAt: "2014-08-16 12:21:16", gps: { latitude: -23.6505, longitude: -46.6197 }, gpsNote: "approximate: São Paulo Zoo; the file page has no location" },
    { name: "mountain-landscape.jpg", title: "File:Mountain landscape (21827581301).jpg", takenAt: "2014-10-21 00:54:00" },
    { name: "landscape-mountains-phaistos.jpg", title: "File:Landscape mountains Phaistos.jpg", takenAt: "2015-02-25 13:11:44", gps: { latitude: 35.051845, longitude: 24.813976 } },
    { name: "lighthouse-chania-evening-sun.jpg", title: "File:Lighthouse Chania evening sun.jpg", takenAt: "2015-02-26 17:18:15", gps: { latitude: 35.51924, longitude: 24.015318 } },
    { name: "dog-puppy-poodle.jpg", title: "File:Dog puppy poodle.jpg", takenAt: "2015-06-04 18:49:00" },
    { name: "lighthouse-harbor-saint-martin.jpg", title: "File:Lighthouse, harbor Saint-Martin-de-Ré, Ré island, Charente-Maritime, France.jpg", takenAt: "2015-08-05 19:08:47", gps: { latitude: 46.207207, longitude: -1.367974 } },
    { name: "entrance-la-rochelle-old.jpg", title: "File:Entrance La Rochelle old harbor.jpg", takenAt: "2015-08-12 18:32:57", gps: { latitude: 46.155396, longitude: -1.153827 } },
    { name: "brussels-canal.jpg", title: "File:Brussels Canal (1).jpg", takenAt: "2015-08-24 13:58:51" },
    { name: "altmunster-pink-mountain-sunset.jpg", title: "File:Altmünster - Pink mountain sunset.jpg", takenAt: "2015-08-29 19:39:56", gps: { latitude: 47.827433, longitude: 13.629287 } },
    { name: "erechtheum-acropolis-athens-evening.jpg", title: "File:Erechtheum Acropolis Athens evening moon.jpg", takenAt: "2015-10-25 17:08:28", gps: { latitude: 37.972392, longitude: 23.723522 } },
    { name: "markellos-tower-aegina-greece.jpg", title: "File:Markellos tower Aegina Greece.jpg", takenAt: "2015-10-27 14:00:03", gps: { latitude: 37.747135, longitude: 23.429503 } },
    { name: "aegina-sunset.jpg", title: "File:Aegina sunset.jpg", takenAt: "2015-10-27 16:40:28", gps: { latitude: 37.745142, longitude: 23.426711 } },
    { name: "aegina-harbour-night.jpg", title: "File:Night view chapel harbour Aegina Greece.jpg", takenAt: "2015-10-27 19:30:00" },
    { name: "trees-along-the-hald.jpg", title: "File:Trees along the Hald Sø Viborg Commune Danemark.jpg", takenAt: "2016-02-22 15:28:30", gps: { latitude: 56.391117, longitude: 9.347166 } },
    { name: "eisvogel-kingfisher.jpg", title: "File:Eisvogel kingfisher.jpg", takenAt: "2016-03-24 09:44:04" },
    { name: "cliffs-over-eretria-euboea.jpg", title: "File:Cliffs over Eretria Euboea Greece.jpg", takenAt: "2016-04-19 14:39:49", gps: { latitude: 38.420571, longitude: 23.82649 } },
    { name: "cat-asleep-on-bench.jpg", title: "File:Chat domestique dormant sur un banc.jpg", takenAt: "2016-07-30 15:57:00" },
    { name: "berismenil-forest-in-snow.jpg", title: "File:Bérismenil-Forest in snow (1).jpg", takenAt: "2017-01-19 10:47:00", gps: { latitude: 50.205376, longitude: 5.661972 } },
    { name: "dog-on-beach.jpg", title: "File:Dog at Nørre Vorupør Strand.jpg", takenAt: "2017-04-14 15:31:48", gps: { latitude: 56.95923, longitude: 8.365443 } },
    { name: "beach-steps.jpg", title: "File:Wooden steps at Nørre Vorupør Strand.jpg", takenAt: "2017-04-14 15:57:00" },
    { name: "evening-market-in-hong.jpg", title: "File:Evening market in Hong Kong.jpg", takenAt: "2017-05-17 14:49:00" },
    { name: "beech-and-ferns.jpg", title: "File:Beech and ferns in Gullmarsskogen.jpg", takenAt: "2017-06-09 13:43:44" },
    { name: "spruce-forest.jpg", title: "File:Spruce forest at Holma.jpg", takenAt: "2017-06-09 19:11:12", gps: { latitude: 58.384771, longitude: 11.558511 } },
    { name: "rose-hips.jpg", title: "File:Rose hips in autumn.jpg", takenAt: "2017-10-06 12:56:41" },
    { name: "princes-road-synagogue-nave.jpg", title: "File:Princes Road Synagogue Nave.jpg", takenAt: "2017-11-28 11:40:14", gps: { latitude: 53.395203, longitude: -2.965096 } },
    { name: "koscio-najswietszego-serca-pana.jpg", title: "File:Kościół Najświętszego Serca Pana Jezusa w Krakowie (ul. Garncarska) 02.jpg", takenAt: "2017-12-04 11:26:02", gps: { latitude: 50.060388, longitude: 19.927162 } },
    { name: "london-northwestern-railway-train.jpg", title: "File:London Northwestern Railway train at Crewe 13 21 15 811000.jpeg", takenAt: "2018-03-14 18:07:08" },
    { name: "banff-river.jpg", title: "File:Banff River 2.jpg", takenAt: "2018-04-27 16:49:30" },
    { name: "tabby-cat.jpg", title: "File:Young tabby cat keeping watch.jpg", takenAt: "2018-06-11 20:31:06" },
    { name: "waterfall-seydisfjordur.jpg", title: "File:Unnamed Waterfall, Seyðisfjörður, Iceland - Flickr - Mustang Joe.jpg", takenAt: "2018-06-23 18:17:00", gps: { latitude: 65.261608, longitude: -13.99165 } },
    { name: "fishing-hut-and-jetties.jpg", title: "File:Fishing hut, jetties and boats in Loddebo.jpg", takenAt: "2018-08-12 16:33:23", gps: { latitude: 58.386223, longitude: 11.451373 } },
    { name: "tree-with-red-apples.jpg", title: "File:Tree with red apples in Barkedal 4.jpg", takenAt: "2018-09-01 11:38:16", gps: { latitude: 58.409836, longitude: 11.574005 } },
    { name: "lords-beach-sandy-bay.jpg", title: "File:Lords Beach, Sandy Bay 20180904-003.jpg", takenAt: "2018-09-04 09:26:00", gps: { latitude: -42.905938, longitude: 147.340867 } },
    { name: "monarch-butterfly-on-butterfly.jpg", title: "File:Monarch butterfly on butterfly bush flower.jpg", takenAt: "2018-09-16 10:24:47", gps: { latitude: 39.975883, longitude: -85.907272 } },
    { name: "horseshoe-falls.jpg", title: "File:Horseshoe-Falls-Zoom.jpg", takenAt: "2018-09-28 17:14:10", gps: { latitude: 43.0788664, longitude: -79.078299 } },
    { name: "miri-city-council.jpg", title: "File:Miri City Council 3.jpg", takenAt: "2019-02-06 17:49:18", gps: { latitude: 4.392615, longitude: 113.987501 } },
    { name: "trinity-church-zverinets.jpg", title: "File:Церковь Троицы Живоначальной в селе Зверинец (Ярославская область) 2.jpg", takenAt: "2019-06-21 15:39:50", gps: { latitude: 57.127234, longitude: 39.268567 } },
    { name: "labrador.jpg", title: "File:Portrait of a labrador retriever.jpg", takenAt: "2019-07-20 18:17:36" },
    { name: "boat-harbour-beach.jpg", title: "File:Boat Harbour Beach 20190722-004.jpg", takenAt: "2019-07-22 13:16:00", gps: { latitude: -40.92866, longitude: 145.618786 } },
    { name: "street-in-ishkashim.jpg", title: "File:A street in Ishkashim.jpg", takenAt: "2019-08-08 09:29:01" },
    { name: "waxing-half-moon-over.jpg", title: "File:Waxing half moon over Brofjorden 1.jpg", takenAt: "2019-09-05 20:03:56", gps: { latitude: 58.388944, longitude: 11.453265 } },
    { name: "waterfall-glandieu.jpg", title: "File:Cascade de Glandieu, octobre 2019 (1).jpg", takenAt: "2019-10-07 17:42:50" },
    { name: "abbey-village-main-street.jpg", title: "File:Abbey Village, main street.jpg", takenAt: "2019-10-23 09:36:00" },
    { name: "pavillon-de-flore.jpg", title: "File:Pavillon de Flore from the Tuileries Garden, Paris 5 November 2019.jpg", takenAt: "2019-11-05 18:54:00", gps: { latitude: 48.863755, longitude: 2.329104 } },
    { name: "hedgehog-in-ball.jpg", title: "File:Hedgehog In Ball.jpg", takenAt: "2020-01-03 09:39:00" },
    { name: "brazil-nordest-house-interior.jpg", title: "File:Brazil Nordest House interior.jpg", takenAt: "2020-01-09 10:28:15" },
    { name: "apple-cake-with-vanilla.jpg", title: "File:Apple cake with vanilla ice cream 2.jpg", takenAt: "2020-03-23 18:07:23", gps: { latitude: 58.384123, longitude: 11.473737 } },
    { name: "train-of-quebec-city.jpg", title: "File:Train of Quebec city.jpg", takenAt: "2020-05-30 20:06:01", gps: { latitude: 46.820262, longitude: -71.21233 } },
    { name: "landmannalaugar-desert-road.jpg", title: "File:Landmannalaugar desert road.jpg", takenAt: "2020-08-12 12:52:00" },
    { name: "price-building-at-night.jpg", title: "File:Price Building illuminated at night in Quebec City.jpg", takenAt: "2020-09-19 17:24:00" },
    { name: "snowy-trees.jpg", title: "File:Lots of trees with snow.jpg", takenAt: "2021-01-17 08:52:19" },
    { name: "winter-riverscape-with-parhelion.jpg", title: "File:Winter riverscape with parhelion.jpg", takenAt: "2021-02-14 13:50:38", gps: { latitude: 51.882564, longitude: 5.892333 } },
    { name: "waves-in-sea.jpg", title: "File:Waves in sea.jpg", takenAt: "2021-03-23 11:54:22" },
    { name: "parc-de-la-chute.jpg", title: "File:Parc de la Chute-Montmorency 001.jpg", takenAt: "2021-04-22 11:28:09", gps: { latitude: 46.89133, longitude: -71.147017 } },
    { name: "upminster-windmill.jpg", title: "File:Upminster Windmill in 2021.jpg", takenAt: "2021-10-05 17:20:38" },
    { name: "geyersworthplatz-in-bamberg-as.jpg", title: "File:Geyerswörthplatz in Bamberg as seen from the Geyerswörthbrücke.jpg", takenAt: "2021-12-22 11:16:41" },
    { name: "pont-de-bercy-paris.jpg", title: "File:Pont de Bercy, Paris 23 December 2021.jpg", takenAt: "2021-12-23 17:25:00", gps: { latitude: 48.838059, longitude: 2.374774 } },
    { name: "castle-of-otranto.jpg", title: "File:Castle of Otranto 03.jpg", takenAt: "2022-05-02 13:14:00", gps: { latitude: 40.144436, longitude: 18.492575 } },
    { name: "marigolds.jpg", title: "File:Tagetes2.jpg", takenAt: "2022-07-09 12:07:59" },
    { name: "ile-d-orleans.jpg", title: "File:Île d'Orléans 009.jpg", takenAt: "2022-07-22 16:25:41", gps: { latitude: 46.991554, longitude: -70.824953 } },
    { name: "nara-deer.jpg", title: "File:Nara deer lounging at Todaiji.jpg", takenAt: "2022-07-26 11:07:32" },
    { name: "konrad-steffen-glacier-christiane.jpg", title: "File:Konrad Steffen Glacier Christiane Leister.jpg", takenAt: "2022-08-13 14:08:31", gps: { latitude: 81.272, longitude: -57.145 } },
    { name: "notre-dame-de-montreal.jpg", title: "File:Notre-Dame de Montréal Basilica 12.jpg", takenAt: "2022-09-03 11:44:56" },
    { name: "autumn-leaves-dumitru-rascanu.jpg", title: "File:Autumn leaves, Dumitru Rascanu park.jpg", takenAt: "2022-10-05 12:02:00" },
    { name: "horse-in-tarcoles-river.jpg", title: "File:Horse in Tárcoles River.jpg", takenAt: "2023-02-08 14:42:00", gps: { latitude: 9.780056, longitude: -84.618583 } },
    { name: "bunny-in-a-basket.jpg", title: "File:Bunny in a basket.jpg", takenAt: "2023-05-03 11:42:00" },
    { name: "echo-park-lake.jpg", title: "File:Echo Park lake in Los Angeles, CA.jpg", takenAt: "2023-05-25 08:27:06" },
    { name: "rio-sugarloaf-sunset.jpg", title: "File:Rio de Janeiro skyline and Sugarloaf Mountain at sunset, Brazil 3.jpg", takenAt: "2023-06-03 14:08:17" },
    { name: "lake-khovsgol.jpg", title: "File:Lake Khövsgöl, Mongolia.jpg", takenAt: "2023-06-27 16:00:00", gps: { latitude: 50.535889, longitude: 100.391861 } },
    { name: "lake-terkhiin-tsagaan.jpg", title: "File:Terkhiin Tsagaan Lake 01.jpg", takenAt: "2023-06-30 10:30:00", gps: { latitude: 48.166333, longitude: 99.76375 } },
    { name: "coast-near-yamabare.jpg", title: "File:Coast near Yamabare (山原) 10.jpg", takenAt: "2023-08-09 18:43:00", gps: { latitude: 24.450536, longitude: 124.167025 } },
    { name: "hydrochoeris-hydrochaeris-in-brazil.jpg", title: "File:Hydrochoeris hydrochaeris in Brazil in Petrópolis, Rio de Janeiro, Brazil 09.jpg", takenAt: "2023-09-17 15:15:45" },
    { name: "gazania-krebsiana-quebec-city.jpg", title: "File:Gazania krebsiana, Quebec city, Quebec, Canada 131.jpg", takenAt: "2023-10-07 12:54:41" },
    { name: "sour-pasta-with-tomatoes.jpg", title: "File:Sour pasta with tomatoes and spinach.jpg", takenAt: "2023-11-20 22:54:53", gps: { latitude: 55.673219, longitude: 37.477753 } },
    { name: "quebec-snow-fog.jpg", title: "File:Snow-covered Quebec City skyline in fog.jpg", takenAt: "2023-12-06 10:27:17" },
    { name: "lake-ontario-shoreline.jpg", title: "File:Lake Ontario Shoreline.jpg", takenAt: "2024-01-02 13:58:08" },
    { name: "bike-on-a-snowy.jpg", title: "File:Bike on a snowy street in Quebec City at night.jpg", takenAt: "2024-01-11 18:33:58" },
    { name: "snowman-on-a-foggy.jpg", title: "File:Snowman on a foggy day.jpg", takenAt: "2024-01-24 13:16:37" },
    { name: "neuschwanstein-castle.jpg", title: "File:Neuschwanstein Castle 2024-02.jpg", takenAt: "2024-02-03 07:32:57", gps: { latitude: 47.5574, longitude: 10.749172 } },
    { name: "dogs-in-serles.jpg", title: "File:Mixed-breed dogs in Serles.jpg", takenAt: "2024-02-05 05:47:53", gps: { latitude: 47.306208, longitude: 11.379364 } },
    { name: "spanish-hall-of-ambras.jpg", title: "File:Spanish Hall of Ambras Castle, Innsbruck (inside)-2024-02-06.jpg", takenAt: "2024-02-06 09:05:25" },
    { name: "train-at-east-croydon.jpg", title: "File:A train at East Croydon.jpg", takenAt: "2024-02-06 12:13:12", gps: { latitude: 51.376422, longitude: -0.092575 } },
    { name: "white-rock-lake.jpg", title: "File:White Rock Lake.jpg", takenAt: "2024-03-10 14:28:00" },
    { name: "boat-on-emre-lake.jpg", title: "File:A boat on the Emre Lake in Afyonkarahisar.jpg", takenAt: "2024-03-17 14:06:25", gps: { latitude: 39.106186, longitude: 30.444242 } },
    { name: "banad-banar-village-jodhpur.jpg", title: "File:Banad (Banar) Village Jodhpur.jpg", takenAt: "2024-04-06 20:05:06" },
    { name: "ginger-kitten-with-an.jpg", title: "File:Ginger kitten with an orange rubber rugby.jpg", takenAt: "2024-04-09 13:24:49" },
    { name: "titus-railroad-park.jpg", title: "File:Titus Railroad Park in Kent, Washington - 1.jpg", takenAt: "2024-05-04 15:21:20", gps: { latitude: 47.379836, longitude: -122.233422 } },
    { name: "flower-garden-hopewell-furnace.jpg", title: "File:Flower garden Hopewell Furnace.jpg", takenAt: "2024-09-22 12:15:27", gps: { latitude: 40.204281, longitude: -75.773558 } },
    { name: "autumn-leaves.jpg", title: "File:Autumn leaves Все краски осени Листья клена 21.jpg", takenAt: "2024-10-18 10:42:32" },
    { name: "quebec-autumn.jpg", title: "File:Autumn in Quebec City (in autumn 02).jpg", takenAt: "2024-10-20 17:04:01" },
    { name: "hmongtown-marketplace-east-building.jpg", title: "File:Hmongtown Marketplace East Building weaving booth.jpg", takenAt: "2024-11-03 16:09:59" },
    { name: "english-flower-garden-hamilton.jpg", title: "File:English Flower Garden - Hamilton Gardens - Hamilton, NZ - DSC06491.jpg", takenAt: "2024-11-05 19:00:43" },
    { name: "masoala-village.jpg", title: "File:Masoala village.jpg", takenAt: "2024-11-22 17:16:49" },
    { name: "rooftop-of-shibuya-stream.jpg", title: "File:Rooftop of Shibuya Stream -46133.jpeg", takenAt: "2024-11-27 18:01:00", gps: { latitude: 35.656883, longitude: 139.703611 } },
    { name: "birthday-cake-bloomsburg-pennsylvania.jpg", title: "File:Birthday Cake Bloomsburg, Pennsylvania.jpg", takenAt: "2024-12-18 11:44:00" },
    { name: "go-away-bird.jpg", title: "File:White-bellied go-away-bird (Corythaixoides leucogaster).jpg", takenAt: "2025-01-18 12:35:53" },
    { name: "man-riding-a-bicycle.jpg", title: "File:Man riding a bicycle in a snowstorm in Quebec city, Quebec, Canada.jpg", takenAt: "2025-02-13 18:29:18" },
    { name: "snowy-forest-path.jpg", title: "File:Snowy Forest Path in Winter.jpg", takenAt: "2025-02-16 17:31:00" },
    { name: "mount-fuji-at-sunset.jpg", title: "File:Mount Fuji at sunset, March 2025.jpg", takenAt: "2025-03-19 18:48:00", gps: { latitude: 35.521311, longitude: 138.757259 } },
    { name: "calm-sea-san-antonio.jpg", title: "File:Calm sea, San Antonio, Ibiza, panoramic.jpg", takenAt: "2025-05-04 14:52:19" },
    { name: "sea-sky-and-clouds.jpg", title: "File:Sea sky and clouds, Ibiza, Spain.jpg", takenAt: "2025-05-29 20:03:52" },
    { name: "balaton-and-badacsony-june.jpg", title: "File:Balaton and Badacsony - June 2025.jpg", takenAt: "2025-06-09 13:23:24" },
    { name: "chocolate-raspberry-dessert.jpg", title: "File:Chocolate raspberry dessert.jpg", takenAt: "2025-07-10 15:01:00" },
    { name: "verona-cityscape-sunny.jpg", title: "File:Verona cityscape sunny.jpg", takenAt: "2025-07-31 18:14:30", gps: { latitude: 45.447833, longitude: 11.002589 } },
    { name: "flowers-of-gomphocarpus-kaessneri.jpg", title: "File:Flowers of Gomphocarpus kaessneri.jpg", takenAt: "2025-08-03 12:56:34", gps: { latitude: -1.243692, longitude: 36.818482 } },
    { name: "nikolauskapelle-between-the-vineyards.jpg", title: "File:Nikolauskapelle between the vineyards, Klingenmünster, 2025.jpg", takenAt: "2025-08-21 17:49:47", gps: { latitude: 49.146852, longitude: 8.013584 } },
    { name: "heatherwood-park-larkspur-ca.jpg", title: "File:Heatherwood Park, Larkspur, CA August 2025.jpg", takenAt: "2025-08-30 07:26:41", gps: { latitude: 37.93614, longitude: -122.52914 } },
    { name: "sonoma-county-museum-sept.jpg", title: "File:Sonoma County Museum, Sept 6 2025.jpg", takenAt: "2025-09-06 12:05:00", gps: { latitude: 38.441684, longitude: -122.71827 } },
    { name: "forest-path-ehrenbach-foliage.jpg", title: "File:Forest path, Ehrenbach, foliage.jpg", takenAt: "2025-10-15 16:48:40" },
    { name: "monschau-autumn.jpg", title: "File:Along the Rur, autumn in Monschau, 2025.jpg", takenAt: "2025-10-18 14:11:14", gps: { latitude: 50.554374, longitude: 6.241492 } },
    { name: "smart-city-by-night.jpg", title: "File:2025 Smart City by night.jpg", takenAt: "2025-10-27 21:05:59" },
    { name: "red-fox-in-snow.jpg", title: "File:Red fox in yard, Charlton MA 2025-12-26.jpg", takenAt: "2025-12-26 13:04:38" },
    { name: "birch-tree-in-gyumri.jpg", title: "File:Birch tree in Gyumri.jpg", takenAt: "2026-02-16 09:48:02", gps: { latitude: 40.822873, longitude: 43.829357 } },
    { name: "domestic-sheep-unidentified-breed.jpg", title: "File:Domestic sheep (unidentified breed).jpg", takenAt: "2026-05-07 12:57:28" },
    { name: "donkmeer-from-a-balloon.jpg", title: "File:View of Donkmeer from a hot air balloon, Berlare, 2026 (1).jpg", takenAt: "2026-07-25 06:50:51", gps: { latitude: 51.055982, longitude: 3.975721 } }
];

/**
 * The video clips, each cut to CLIP_SECONDS from `startSeconds` and made
 * twice, as `<name>.mp4` and `<name>.mov` (see encodeClip), or only in the
 * `containers` given. `creationTime` is
 * written as the creation_time metadata, which video processing reads as when
 * the video was shot: the date the file page gives, with a made-up time of day.
 */
const CLIPS = [
    { name: "sea-foam", title: "File:Sea Foam off Amphitrite Point near Ucluelet.webm", startSeconds: 8, creationTime: "2015-08-25T18:42:10Z" },
    { name: "loons", title: "File:Loons Swimming in Wood Lake BC on a Summer Morning.webm", startSeconds: 4, creationTime: "2015-08-03T14:05:30Z" },
    { name: "waterfall-vertical", title: "File:Watagataki Falls (Video).webm", startSeconds: 3, creationTime: "2025-11-12T03:20:45Z" },
    { name: "nerang-river", title: "File:Nerang River at Numinbah Valley, Queensland.webm", startSeconds: 4, creationTime: "2016-01-28T08:15:20Z", containers: ["mp4"] }
];

/** The containers a clip is made in */
const containersOf = (clip) => clip.containers ?? ["mp4", "mov"];

/**
 * The broken video, `<name>.mp4`: an H.264/AAC MP4 cut from one of the clips
 * whose audio track is then made unreadable, by changing its codec (the sample
 * entry's fourcc and the decoder config's object type) to one no decoder
 * knows. Upload accepts it, because reading its metadata and taking its
 * thumbnail only need the video track. Video processing fails on it: the audio
 * is not AAC, so it is not web-safe, and making its Rendition needs the audio
 * decoded, which ffmpeg cannot do.
 */
const BROKEN = {
    name: "broken-audio",
    title: "File:Loons Swimming in Wood Lake BC on a Summer Morning.webm",
    startSeconds: 20,
    creationTime: "2015-08-03T14:12:00Z"
};

/** Checks the licences, prepares every file in the staging directory, then swaps it in for demo/media */
async function main() {
    const titles = [...new Set([...PHOTOS, ...CLIPS, BROKEN].map((file) => file.title))];
    const pages = await fetchFilePages(titles);

    await rm(STAGING_DIR, { recursive: true, force: true });
    await mkdir(STAGING_DIR, { recursive: true });
    for (const photo of PHOTOS) {
        console.log(`Photo ${photo.name}`);
        await preparePhoto(photo, pages.get(photo.title));
    }
    for (const clip of CLIPS) {
        console.log(`Clip ${clip.name}`);
        for (const container of containersOf(clip)) {
            await encodeClip(clip, pages.get(clip.title), container);
        }
    }
    console.log(`Broken video ${BROKEN.name}`);
    await prepareBroken(BROKEN, pages.get(BROKEN.title));
    await writeSources(pages);

    await rm(MEDIA_DIR, { recursive: true, force: true });
    await rename(STAGING_DIR, MEDIA_DIR);
    const names = await readdir(MEDIA_DIR);
    let total = 0;
    for (const name of names) {
        total += (await stat(path.join(MEDIA_DIR, name))).size;
    }
    console.log(`${names.length} files, ${(total / 1024 / 1024).toFixed(1)} MiB in ${MEDIA_DIR}`);
}

/**
 * Reads each file's page from Commons: its download URL, author and licence,
 * and the licence templates in its wikitext. Stops unless the page licenses
 * the file as CC0 or public domain.
 */
async function fetchFilePages(titles) {
    const pages = new Map();
    const BATCH = 20;
    for (let i = 0; i < titles.length; i += BATCH) {
        const batch = titles.slice(i, i + BATCH).join("|");
        const [info, wikitext] = await Promise.all([
            commonsQuery({ prop: "imageinfo", iiprop: "extmetadata|url", titles: batch }),
            commonsQuery({ prop: "revisions", rvprop: "content", rvslots: "main", titles: batch })
        ]);
        for (const page of info.query.pages) {
            if (page.missing) {
                throw new Error(`${page.title} does not exist on Commons`);
            }
            const imageinfo = page.imageinfo[0];
            const meta = imageinfo.extmetadata;
            const text = wikitext.query.pages.find((p) => p.title === page.title).revisions[0].slots.main.content;
            const licenceTemplates = [...text.matchAll(/\{\{\s*((?:self\s*\|\s*)?(?:cc-zero|pd-[^}|]*|public domain[^}|]*))\s*\}\}/gi)].map(
                (match) => `{{${match[1]}}}`
            );
            const licence = meta.LicenseShortName?.value ?? "";
            if (!/^(CC0|Public domain)$/i.test(licence) || licenceTemplates.length === 0) {
                throw new Error(`${page.title} is not CC0 or public domain on its file page (licence '${licence}')`);
            }
            pages.set(page.title, {
                title: page.title,
                pageUrl: imageinfo.descriptionurl,
                downloadUrl: imageinfo.url,
                author: stripHtml(meta.Artist?.value),
                credit: stripHtml(meta.Credit?.value),
                licence,
                licenceTemplates
            });
        }
    }
    return pages;
}

/** Runs a query against the Commons API and returns its JSON */
async function commonsQuery(params) {
    const query = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
    const response = await fetchFromCommons(`${COMMONS_API}?${query}`);
    return response.json();
}

/** Downloads a whole file into memory */
async function download(url) {
    const response = await fetchFromCommons(url);
    return Buffer.from(await response.arrayBuffer());
}

/** How many times a request Commons rate-limits (429) is tried again */
const RATE_LIMIT_RETRIES = 5;

async function fetchFromCommons(url) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
            // Waits as long as Commons asks, or doubles from 5 s when it doesn't say
            const seconds = Number(response.headers.get("retry-after")) || 5 * 2 ** attempt;
            console.log(`Commons is rate limiting; trying again in ${seconds} s`);
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
            continue;
        }
        if (!response.ok) {
            throw new Error(`Commons responded ${response.status} for ${url}`);
        }
        return response;
    }
}

/**
 * Downscales a photo to a JPEG and writes EXIF chosen for the demo in place of
 * the original's: the taken date, GPS for some, and the author and licence.
 */
async function preparePhoto(photo, page) {
    const original = await download(page.downloadUrl);
    // Decoded to raw pixels first, so none of the original's metadata survives;
    // the default pipeline converts the pixels to sRGB and applies the orientation
    const { data, info } = await sharp(original)
        .rotate()
        .resize({ width: PHOTO_LONG_EDGE, height: PHOTO_LONG_EDGE, fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const exifDate = photo.takenAt.replace(/-/g, ":");
    const exif = {
        IFD0: {
            Artist: asciiOnly(page.author),
            Copyright: `${page.licence} (${page.pageUrl})`,
            Software: "holvi demo/prepare-media.mjs"
        },
        IFD2: { DateTimeOriginal: exifDate, DateTimeDigitized: exifDate },
        ...(photo.gps ? { IFD3: gpsIfd(photo.gps) } : {})
    };
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .jpeg({ quality: PHOTO_JPEG_QUALITY, mozjpeg: true })
        .withMetadata({ exif })
        .toFile(path.join(STAGING_DIR, photo.name));
}

/** EXIF GPS fields for decimal degrees, as libvips writes them from strings */
function gpsIfd({ latitude, longitude }) {
    return {
        GPSLatitudeRef: latitude < 0 ? "S" : "N",
        GPSLatitude: degreesMinutesSeconds(latitude),
        GPSLongitudeRef: longitude < 0 ? "W" : "E",
        GPSLongitude: degreesMinutesSeconds(longitude)
    };
}

/** Rational degrees, minutes and thousandths of seconds, such as "22/1 56/1 57210/1000" */
function degreesMinutesSeconds(decimal) {
    // Rounded once, as a whole, so rounding never leaves 60 seconds or 60 minutes
    const thousandthsOfSeconds = Math.round(Math.abs(decimal) * 3600 * 1000);
    const degrees = Math.floor(thousandthsOfSeconds / 3_600_000);
    const minutes = Math.floor((thousandthsOfSeconds % 3_600_000) / 60_000);
    const seconds = thousandthsOfSeconds % 60_000;
    return `${degrees}/1 ${minutes}/1 ${seconds}/1000`;
}

/** How each container's clips are encoded; both have AAC stereo audio */
const VIDEO_ENCODINGS = {
    /** Web-safe, so video processing makes no Rendition */
    mp4: {
        description: `H.264 (High profile, yuv420p, CRF ${H264_CRF}) with AAC stereo audio, moov atom at the front`,
        args: ["-c:v", "libx264", "-preset", "slow", "-crf", String(H264_CRF), "-profile:v", "high", "-movflags", "+faststart"]
    },
    /** Not web-safe, so video processing makes a Rendition */
    mov: {
        description: `HEVC (yuv420p, CRF ${HEVC_CRF}, tagged hvc1 like Apple devices) with AAC stereo audio in QuickTime MOV`,
        args: ["-c:v", "libx265", "-preset", "medium", "-crf", String(HEVC_CRF), "-tag:v", "hvc1", "-x265-params", "log-level=error"]
    }
};

/**
 * Cuts a clip straight from the original's URL (ffmpeg seeks with range
 * requests, so only the part it needs is downloaded) and encodes it as
 * `<name>.<container>` in the staging directory. Returns the file's path.
 */
async function encodeClip(clip, page, container) {
    const target = path.join(STAGING_DIR, `${clip.name}.${container}`);
    await ffmpeg([
        ...["-ss", String(clip.startSeconds), "-user_agent", USER_AGENT, "-i", page.downloadUrl],
        ...["-t", String(CLIP_SECONDS)],
        // The first video and audio streams, without the original's metadata
        ...["-map", "0:v:0", "-map", "0:a:0", "-map_metadata", "-1"],
        ...VIDEO_ENCODINGS[container].args,
        ...["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ac", "2"],
        ...["-metadata", `creation_time=${clip.creationTime}`],
        ...["-f", container, target]
    ]);
    return target;
}

/** Encodes the broken video as an MP4 clip, then breaks its audio codec */
async function prepareBroken(broken, page) {
    const target = await encodeClip(broken, page, "mp4");
    const content = await readFile(target);
    breakAudioCodec(content);
    await writeFile(target, content);
}

/**
 * Changes an MP4's AAC audio track to an unknown codec in place: the sample
 * entry's fourcc (mp4a) and the object type in its decoder config (esds).
 */
function breakAudioCodec(content) {
    const find = (text, from = 0) => {
        const at = content.indexOf(Buffer.from(text, "latin1"), from);
        if (at < 0) {
            throw new Error(`No '${text}' box in the broken video`);
        }
        return at;
    };
    const sampleEntry = find("mp4a", find("stsd", find("soun")));
    content.write(UNKNOWN_FOURCC, sampleEntry, "latin1");
    // After the box type and its version and flags: the ES descriptor, then the decoder config descriptor
    let offset = find("esds", sampleEntry) + 8;
    offset = skipDescriptorHeader(content, offset, 0x03);
    const esFlags = content[offset + 2];
    if (esFlags !== 0) {
        throw new Error("The ES descriptor has optional fields this script does not skip");
    }
    offset = skipDescriptorHeader(content, offset + 3, 0x04);
    if (content[offset] !== AAC_OBJECT_TYPE) {
        throw new Error("The audio track is not AAC");
    }
    content[offset] = UNKNOWN_OBJECT_TYPE;
}

/** Skips an MPEG-4 descriptor's tag and its 1–4 byte length */
function skipDescriptorHeader(content, offset, tag) {
    if (content[offset] !== tag) {
        throw new Error(`Expected descriptor tag ${tag} in the broken video`);
    }
    let length = 1;
    while (content[offset + length] & 0x80 && length < 4) {
        length++;
    }
    return offset + 1 + length;
}

/** Runs the bundled ffmpeg, which throws with its error output if it fails */
async function ffmpeg(args) {
    await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 16 * 1024 * 1024 });
}

/** Writes SOURCES.md: where each file came from, its licence, and how it was prepared */
async function writeSources(pages) {
    const sizeOf = async (name) => `${((await stat(path.join(STAGING_DIR, name))).size / 1024).toFixed(0)} KiB`;
    const source = (page) =>
        `[${page.title.replace(/^File:/, "")}](${page.pageUrl}) by ${page.author} (${page.credit}), licence ${page.licence} (${page.licenceTemplates.join(", ")} on the file page)`;
    const videoTable = ["| File | Size | Codecs and container | Duration | creation_time | Source |", "| --- | --- | --- | --- | --- | --- |"];
    const videoRow = async (name, clip) => {
        const { codecs, duration } = await describeVideo(name);
        return `| ${name} | ${await sizeOf(name)} | ${codecs} | ${duration} | ${clip.creationTime} | ${source(pages.get(clip.title))}, from ${clip.startSeconds} s |`;
    };
    const lines = [
        "# Sample media sources",
        "",
        "The demo environment's sample media. Every file is prepared from an original on",
        "Wikimedia Commons whose file page licenses it as CC0, the Creative Commons public",
        "domain dedication (https://creativecommons.org/publicdomain/zero/1.0/), or as public",
        "domain. Each row gives the licence and links the file page, which is where the",
        "licence is stated. `demo/prepare-media.mjs` checks the licence on each file page (its",
        "licence templates and the licence Commons reports for it) before it prepares anything,",
        "downloads the originals and writes these files. Run it again to reproduce them:",
        "`node demo/prepare-media.mjs`.",
        "",
        `Licences last checked: ${new Date().toISOString().slice(0, 10)}.`,
        "",
        "## Photos",
        "",
        `Each original was downscaled once to at most ${PHOTO_LONG_EDGE} px on the long edge (after applying its`,
        `EXIF orientation), converted to sRGB and saved as JPEG at quality ${PHOTO_JPEG_QUALITY} (mozjpeg). All of`,
        "the original's metadata was removed. The EXIF written in its place is chosen for the",
        "demo, not the camera's: the taken date (DateTimeOriginal and DateTimeDigitized, which",
        "have no time zone; Holvi reads them as UTC) is the date on the file page, with a made-up",
        "time of day where the page gives none; GPS, on some photos only, is the location on the",
        "file page unless noted; Artist is the author and Copyright the licence and file page.",
        "",
        "| File | Size | Taken date written | GPS written | Source |",
        "| --- | --- | --- | --- | --- |"
    ];
    for (const photo of PHOTOS) {
        const gps = photo.gps
            ? `${photo.gps.latitude}, ${photo.gps.longitude}${photo.gpsNote ? ` (${photo.gpsNote})` : ""}`
            : "none";
        lines.push(`| ${photo.name} | ${await sizeOf(photo.name)} | ${photo.takenAt} | ${gps} | ${source(pages.get(photo.title))} |`);
    }
    lines.push(
        "",
        "## Videos",
        "",
        `Each clip is ${CLIP_SECONDS} seconds cut from the original, from the start time given,`,
        "at the original's resolution and frame rate, without the original's metadata. It is",
        "encoded twice, with its creation_time metadata set to the date on the file page and",
        "a made-up time of day:",
        "",
        `- \`.mp4\`: ${VIDEO_ENCODINGS.mp4.description}. Web-safe, so video processing makes no Rendition.`,
        `- \`.mov\`: ${VIDEO_ENCODINGS.mov.description}. Not web-safe, so video processing makes a Rendition.`,
        "",
        ...videoTable
    );
    for (const clip of CLIPS) {
        for (const container of containersOf(clip)) {
            lines.push(await videoRow(`${clip.name}.${container}`, clip));
        }
    }
    const objectType = (value) => `0x${value.toString(16)}`;
    lines.push(
        "",
        "## Broken video",
        "",
        `\`${BROKEN.name}.mp4\` is made like the \`.mp4\` clips, and then its audio track's codec is changed`,
        `to one no decoder knows (the sample entry's fourcc \`mp4a\` becomes \`${UNKNOWN_FOURCC}\`, and the object`,
        `type in its decoder config, ${objectType(AAC_OBJECT_TYPE)} for AAC, becomes ${objectType(UNKNOWN_OBJECT_TYPE)}). Upload accepts it, since its`,
        "metadata and thumbnail need only the video track. Video processing fails on it: its",
        "audio is not AAC, so it needs a Rendition, and making one needs the audio decoded, so it",
        "ends up failed with ffmpeg's `Decoder (codec none) not found for input stream #0:1`.",
        "",
        ...videoTable,
        await videoRow(`${BROKEN.name}.mp4`, BROKEN),
        ""
    );
    await writeFile(path.join(STAGING_DIR, "SOURCES.md"), lines.join("\n"));
}

/** A video's codecs, container and resolution, and its duration, as ffprobe reads them */
async function describeVideo(name) {
    const { stdout } = await run(ffprobe.path, [
        ...["-v", "error", "-print_format", "json", "-show_format", "-show_streams"],
        path.join(STAGING_DIR, name)
    ]);
    const { streams, format } = JSON.parse(stdout);
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");
    const audioCodec = !audio ? "no audio" : audio.codec_name ?? `unknown audio codec (${audio.codec_tag_string})`;
    const container = format.tags?.major_brand?.trim() === "qt" ? "MOV" : "MP4";
    return {
        codecs: `${video.codec_name} + ${audioCodec}, ${container}, ${video.width}x${video.height}`,
        duration: `${Number(format.duration).toFixed(2)} s`
    };
}

/** The text of the HTML Commons returns for metadata such as the author */
function stripHtml(html) {
    return (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** EXIF text fields are ASCII: accents are dropped, anything else becomes ? */
function asciiOnly(text) {
    return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\x20-\x7e]/g, "?");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
