// The scenario plan: what an empty demo is seeded with, as data. The seed
// signs up every User, then creates each collection for its owner, uploads
// its files, tags them, picks its Chosen cover and records its Opens, and then
// backdates the times the API cannot set. Every file names a sample file from
// samples.mjs. Times are relative to when the seed runs, so a demo seeded
// later has the same scenarios.

import { BROKEN_VIDEO, SAMPLES } from "./samples.mjs";

/** The demo's Users, by the name the plan and the checks call them */
export const USERS = {
    demo: { username: "demo", password: "demo1234" },
    other: { username: "other", password: "other1234" }
};

/** When the seed started; every planned time is before it */
export const SEEDED_AT = new Date();

/** A time the given number of days, and hours, before the seed started */
export function daysAgo(days, hours = 0) {
    return new Date(SEEDED_AT.getTime() - (days * 24 + hours) * 3_600_000);
}

/**
 * @typedef {{
 *   sample: string,
 *   name?: string,
 *   tags?: string[]
 * }} PlannedFile a sample file, optionally renamed, and its file tags
 * @typedef {{
 *   owner: keyof typeof USERS,
 *   name: string,
 *   description?: string,
 *   tags?: string[],
 *   created: Date,
 *   added?: Date,
 *   cover?: string,
 *   opens?: Date[],
 *   files: PlannedFile[]
 * }} PlannedCollection a collection, created at `created`, whose files were
 *   all added at `added` (its Last added to). The client sends `added` as
 *   each file's last-modified time, which is also its taken time when it has
 *   no taken date of its own. `cover` names the file that is its Chosen
 *   cover; without one, its Cover rotates. `opens` are the times of its
 *   Opens, oldest first, each at least 30 minutes after the one before.
 * @type {PlannedCollection[]}
 */
export const COLLECTIONS = [
    {
        owner: "demo",
        name: "Evening by the sea",
        description: "Sunset over Aegina harbour",
        tags: ["Sunsets"],
        created: daysAgo(30),
        added: daysAgo(30),
        opens: [daysAgo(29), daysAgo(20), daysAgo(3)],
        files: samples("aegina-sunset.jpg")
    },
    {
        owner: "demo",
        name: "Aegina, October 2015",
        description: "A week on the island, out of season",
        tags: ["Greece", "Travel"],
        created: daysAgo(330),
        added: daysAgo(20),
        cover: "aegina-harbour-night.jpg",
        opens: [daysAgo(320), daysAgo(100), daysAgo(19), daysAgo(5), daysAgo(1)],
        files: samples(
            "aegina-harbour-night.jpg",
            "markellos-tower-aegina-greece.jpg"
        )
    },
    {
        owner: "demo",
        name: "Wood Lake loons",
        description: "A summer morning in British Columbia",
        tags: ["Birds", "Canada"],
        created: daysAgo(300),
        added: daysAgo(290),
        cover: "loons.mp4",
        // The most opened
        opens: [
            daysAgo(289),
            daysAgo(150),
            daysAgo(60),
            daysAgo(14),
            daysAgo(7),
            daysAgo(4),
            daysAgo(2),
            daysAgo(1)
        ],
        files: samples("loons.mp4", "loons.mov")
    },
    {
        owner: "demo",
        name: "Old phone, 2019",
        description: "Copied off the old phone before it went to recycling",
        // A Forgotten collection never opened
        created: daysAgo(700),
        added: daysAgo(700),
        files: samples(
            "street-in-ishkashim.jpg",
            "pavillon-de-flore.jpg",
            "miri-city-council.jpg"
        )
    },
    {
        owner: "demo",
        name: "Mongolia 2023",
        description: "Two lakes in the north",
        tags: ["Travel", "Mongolia"],
        created: daysAgo(800),
        added: daysAgo(790),
        // A Forgotten collection last opened more than a year ago
        opens: [daysAgo(795), daysAgo(700), daysAgo(500), daysAgo(450)],
        files: samples("lake-khovsgol.jpg", "lake-terkhiin-tsagaan.jpg")
    },
    {
        owner: "demo",
        name: "Living room wall ideas",
        description: "Nothing picked yet",
        tags: ["Home"],
        created: daysAgo(12),
        files: []
    },
    everyday({
        name: "Waterfalls",
        tags: ["Water"],
        created: 200,
        added: 15,
        opens: [150, 14],
        files: [
            "waterfall-glandieu.jpg",
            "parc-de-la-chute.jpg",
            "waterfall-seydisfjordur.jpg"
        ]
    }),
    everyday({
        name: "Budapest weekend",
        tags: ["Hungary", "Travel"],
        created: 250,
        added: 250,
        files: ["chain-bridge-budapest-night.jpg"]
    }),
    everyday({
        name: "Spain 2014",
        tags: ["Spain", "Travel", "summer"],
        created: 280,
        added: 100,
        opens: [99, 50, 8],
        files: [
            "beach-parasols-evening.jpg",
            "water-lily-alhambra.jpg",
            "paella.jpg"
        ]
    }),
    everyday({
        name: "Beach days",
        tags: ["Beach", "Summer"],
        created: 120,
        added: 60,
        opens: [59, 10],
        files: [
            "beach-steps.jpg",
            "lords-beach-sandy-bay.jpg",
            "fishing-boat-aground.jpg"
        ]
    }),
    everyday({
        name: "Denmark, Easter 2017",
        tags: ["Denmark"],
        created: 310,
        added: 305,
        opens: [304],
        files: [
            "dog-on-beach.jpg",
            "danish-coast.jpg"
        ]
    }),
    everyday({
        name: "Swedish forests",
        tags: ["Nature"],
        created: 150,
        added: 140,
        files: ["beech-and-ferns.jpg", "spruce-forest.jpg"]
    }),
    everyday({
        name: "Autumn colours",
        tags: ["Autumn"],
        created: 90,
        added: 10,
        opens: [9, 2],
        files: [
            "rose-hips.jpg",
            "autumn-leaves.jpg",
            "autumn-leaves-dumitru-rascanu.jpg"
        ]
    }),
    everyday({
        name: "Snow days",
        tags: ["Winter"],
        created: 60,
        added: 5,
        opens: [4, 0.5],
        files: [
            "snowy-trees.jpg",
            "photo-of-dutch-winter.jpg",
            "berismenil-forest-in-snow.jpg"
        ]
    }),
    everyday({
        name: "Cats",
        tags: ["Pets"],
        created: 350,
        added: 45,
        opens: [44, 30, 20, 10, 5, 3],
        files: [
            { sample: "cat-asleep-on-bench.jpg", tags: ["Sleeping"] },
            "tabby-cat.jpg"
        ]
    }),
    everyday({
        name: "Dogs",
        tags: ["Pets"],
        created: 340,
        added: 200,
        opens: [199, 100],
        files: [
            "labrador.jpg",
            "dogs-in-serles.jpg"
        ]
    }),
    everyday({
        name: "Birds",
        tags: ["Birds"],
        created: 100,
        added: 95,
        files: [
            "go-away-bird.jpg",
            "eisvogel-kingfisher.jpg"
        ]
    }),
    everyday({
        name: "Christmas 2011",
        tags: ["Christmas", "Food"],
        created: 270,
        added: 270,
        files: ["buche-de-noel.jpg"]
    }),
    everyday({
        name: "Food",
        tags: ["Food"],
        created: 260,
        added: 30,
        opens: [29],
        files: [
            "sour-pasta-with-tomatoes.jpg",
            "chocolate-raspberry-dessert.jpg"
        ]
    }),
    everyday({
        name: "Quebec City",
        tags: ["Canada", "Travel"],
        created: 230,
        added: 225,
        opens: [224],
        files: ["quebec-snow-fog.jpg", "quebec-autumn.jpg"]
    }),
    everyday({
        name: "Rio de Janeiro",
        tags: ["Brazil", "Travel"],
        created: 180,
        added: 180,
        files: ["rio-sugarloaf-sunset.jpg"]
    }),
    everyday({
        name: "Niagara Falls",
        tags: ["Canada", "Water"],
        created: 190,
        added: 185,
        files: ["horseshoe-falls.jpg"]
    }),
    everyday({
        name: "São Paulo Zoo",
        tags: ["Brazil", "Birds"],
        created: 175,
        added: 175,
        files: ["flamingos-sao-paulo-zoo.jpg"]
    }),
    everyday({
        name: "Monschau",
        tags: ["Germany", "Autumn"],
        created: 50,
        added: 48,
        files: ["monschau-autumn.jpg"]
    }),
    everyday({
        name: "Garden flowers",
        tags: ["Flowers"],
        created: 110,
        added: 25,
        opens: [24, 12, 6],
        files: [
            "marigolds.jpg",
            "flower-garden-hopewell-furnace.jpg",
            "english-flower-garden-hamilton.jpg"
        ]
    }),
    everyday({
        name: "Sunsets",
        tags: ["sunsets"],
        created: 160,
        added: 7,
        opens: [6, 3],
        files: [
            "juan-griego-sunset.jpg",
            "erechtheum-acropolis-athens-evening.jpg",
            "altmunster-pink-mountain-sunset.jpg"
        ]
    }),
    everyday({
        name: "Night photos",
        created: 140,
        added: 130,
        files: [
            "price-building-at-night.jpg",
            "hong-kong-skyscrapers.jpg"
        ]
    }),
    everyday({
        name: "Wildlife",
        tags: ["Animals"],
        created: 80,
        added: 4,
        opens: [3.5],
        files: [
            "red-fox-in-snow.jpg",
            "nara-deer.jpg",
            "hedgehog-in-ball.jpg"
        ]
    }),
    everyday({
        name: "Sea foam",
        tags: ["Water"],
        created: 70,
        added: 70,
        files: ["sea-foam.mp4"]
    }),
    everyday({
        name: "Portrait videos",
        created: 40,
        added: 40,
        files: ["waterfall-vertical.mp4"]
    }),
    everyday({
        name: "Lakes",
        tags: ["Water"],
        created: 130,
        added: 125,
        files: [
            "lake-ontario-shoreline.jpg",
            "boat-on-emre-lake.jpg",
            "white-rock-lake.jpg"
        ]
    }),
    everyday({
        name: "Trees",
        tags: ["Nature"],
        created: 125,
        added: 50,
        files: [
            "tree-with-red-apples.jpg",
            "trees-along-the-hald.jpg",
            "birch-tree-in-gyumri.jpg"
        ]
    }),
    everyday({
        name: "Bridges",
        created: 115,
        added: 115,
        files: ["general-rafael-urdaneta-bridge.jpg"]
    }),
    everyday({
        name: "Harbours",
        tags: ["Greece"],
        created: 105,
        added: 105,
        files: ["boat-harbour-beach.jpg"]
    }),
    everyday({
        name: "Winter 2021",
        tags: ["Winter"],
        created: 95,
        added: 95,
        files: ["winter-riverscape-with-parhelion.jpg"]
    }),
    everyday({
        name: "Summer 2022",
        tags: ["Flowers"],
        created: 85,
        added: 85,
        files: ["ile-d-orleans.jpg"]
    }),
    everyday({
        name: "Holiday 2023",
        tags: ["Travel"],
        created: 75,
        added: 72,
        files: [
            "echo-park-lake.jpg",
            "coast-near-yamabare.jpg"
        ]
    }),
    everyday({
        name: "Canada",
        tags: ["Canada"],
        created: 65,
        added: 12,
        opens: [11],
        files: [
            "gazania-krebsiana-quebec-city.jpg",
            "banff-river.jpg",
            "notre-dame-de-montreal.jpg"
        ]
    }),
    everyday({
        name: "Pets",
        tags: ["Pets"],
        created: 55,
        added: 3,
        opens: [2.5],
        files: [
            "ginger-kitten-with-an.jpg",
            "bunny-in-a-basket.jpg",
            "dog-puppy-poodle.jpg"
        ]
    }),
    everyday({
        name: "Greece",
        tags: ["Greece"],
        created: 45,
        added: 44,
        files: ["cliffs-over-eretria-euboea.jpg"]
    }),
    everyday({
        name: "Hungary",
        tags: ["Hungary"],
        created: 35,
        added: 34,
        files: ["balaton-and-badacsony-june.jpg"]
    }),
    everyday({
        name: "Brazil",
        tags: ["Brazil"],
        created: 28,
        added: 27,
        files: [
            "brazil-nordest-house-interior.jpg",
            "hydrochoeris-hydrochaeris-in-brazil.jpg"
        ]
    }),
    everyday({
        name: "Germany",
        tags: ["Germany"],
        created: 25,
        added: 24,
        files: ["geyersworthplatz-in-bamberg-as.jpg"]
    }),
    everyday({
        name: "Japan",
        tags: ["Japan"],
        created: 22,
        added: 21,
        files: ["mount-fuji-at-sunset.jpg"]
    }),
    everyday({
        name: "Water",
        tags: ["Water"],
        created: 18,
        added: 17,
        files: [
            "ja1271-crossing-the-otaki.jpg",
            "waves-in-sea.jpg"
        ]
    }),
    everyday({
        name: "Wallpapers",
        created: 16,
        added: 2,
        files: [
            "mountain-and-landscape.jpg",
            "mountain-landscape.jpg",
            "landscape-mountains-phaistos.jpg"
        ]
    }),
    everyday({
        name: "Favourites 2025",
        created: 14,
        added: 6,
        opens: [5, 4, 3, 2, 1, 0.25],
        files: [
            "smart-city-by-night.jpg",
            "flowers-of-gomphocarpus-kaessneri.jpg",
            "calm-sea-san-antonio.jpg"
        ]
    }),
    everyday({
        name: "Throwbacks",
        created: 11,
        added: 9,
        files: [
            "beach-near-otaru.jpg",
            "rideau-river-ottawa-canada.jpg",
            "suzuka-mountains-from-mount.jpg"
        ]
    }),
    everyday({
        name: "France",
        tags: ["France"],
        created: 9,
        added: 8,
        files: [
            "punta-di-a-coscia.jpg",
            "pont-de-bercy-paris.jpg"
        ]
    }),
    everyday({
        name: "Print these",
        created: 6,
        added: 0.5,
        files: [
            "cruiser-butterfly.jpg",
            "monarch-butterfly-on-butterfly.jpg"
        ]
    }),
    // The second User's own few, with tags demo never uses
    {
        owner: "other",
        name: "Hiking in Sweden",
        tags: ["Hiking"],
        created: daysAgo(200),
        added: daysAgo(150),
        opens: [daysAgo(100)],
        files: samples("beech-and-ferns.jpg", "spruce-forest.jpg")
    },
    {
        owner: "other",
        name: "Family dinners",
        tags: ["Family"],
        created: daysAgo(90),
        added: daysAgo(80),
        files: samples("paella.jpg", "buche-de-noel.jpg")
    },
    {
        owner: "other",
        name: "Our cat",
        tags: ["Family"],
        created: daysAgo(40),
        added: daysAgo(15),
        files: [
            { sample: "tabby-cat.jpg", tags: ["Kitty"] },
            { sample: "cat-asleep-on-bench.jpg", tags: ["Kitty"] }
        ]
    },
    // Its HEVC videos twice, as they take longest to process
    {
        owner: "demo",
        name: "Unsorted",
        description: "Everything that still needs a proper home",
        created: daysAgo(1000),
        added: daysAgo(2),
        opens: [daysAgo(600), daysAgo(200), daysAgo(30), daysAgo(2, 5)],
        files: withTags(
            {
                "princes-road-synagogue-nave.jpg": ["Favourite"],
                "titus-railroad-park.jpg": ["Favourite"],
                "train-at-east-croydon.jpg": ["Favourite", "Animals"],
                "fishing-hut-and-jetties.jpg": ["Animals"],
                "snowy-forest-path.jpg": ["Animals"]
            },
            samples(
                "princes-road-synagogue-nave.jpg",
                "hmongtown-marketplace-east-building.jpg",
                "evening-market-in-hong.jpg",
                "sonoma-county-museum-sept.jpg",
                "hong-kong-park.jpg",
                "titus-railroad-park.jpg",
                "heatherwood-park-larkspur-ca.jpg",
                "birthday-cake-bloomsburg-pennsylvania.jpg",
                "apple-cake-with-vanilla.jpg",
                "bike-on-a-snowy.jpg",
                "man-riding-a-bicycle.jpg",
                "train-of-quebec-city.jpg",
                "train-at-east-croydon.jpg",
                "london-northwestern-railway-train.jpg",
                "church-of-the-virgin.jpg",
                "trinity-church-zverinets.jpg",
                "koscio-najswietszego-serca-pana.jpg",
                "neuschwanstein-castle.jpg",
                "spanish-hall-of-ambras.jpg",
                "castle-of-otranto.jpg",
                "fishing-hut-and-jetties.jpg",
                "fishing-boats-morning-beach.jpg",
                "beached-wooden-fishing-boat.jpg",
                "waxing-half-moon-over.jpg",
                "entrance-la-rochelle-old.jpg",
                "abondance-louis-petitot-pont.jpg",
                "victoria-harbour-skyscrapers.jpg",
                "grenade-albayzin-depuis-alhambra.jpg",
                "verona-cityscape-sunny.jpg",
                "horse-in-tarcoles-river.jpg",
                "blueberries-in-pack.jpg",
                "lighthouse-chania-evening-sun.jpg",
                "lighthouse-harbor-saint-martin.jpg",
                "snowy-forest-path.jpg",
                "forest-path-ehrenbach-foliage.jpg",
                "masoala-village.jpg",
                "abbey-village-main-street.jpg",
                "banad-banar-village-jodhpur.jpg",
                "upminster-windmill.jpg",
                "rooftop-of-shibuya-stream.jpg",
                "bunch-tulip-paris.jpg",
                "domestic-sheep-unidentified-breed.jpg",
                "brussels-canal.jpg",
                "snowman-on-a-foggy.jpg",
                "fishermen-with-his-son.jpg",
                "nikolauskapelle-between-the-vineyards.jpg",
                "sea-sky-and-clouds.jpg",
                "donkmeer-from-a-balloon.jpg",
                "landmannalaugar-desert-road.jpg",
                "konrad-steffen-glacier-christiane.jpg"
            )
        )
    },
    // Last, and last added to of the collections with videos: the seed
    // uploads videos last, and video processing takes the oldest first, so
    // these are still in Activity when the checks start
    {
        owner: "demo",
        name: "Clips to sort",
        description: "Straight off the phone",
        created: daysAgo(3),
        added: daysAgo(1),
        // The most recently opened
        opens: [daysAgo(0, 1)],
        files: samples(
            "nerang-river.mp4",
            "sea-foam.mov",
            "waterfall-vertical.mov",
            BROKEN_VIDEO
        )
    }
];

/** The files, with file tags for those named in `tagsByName` */
function withTags(tagsByName, files) {
    return files.map((file) => ({ ...file, tags: tagsByName[fileName(file)] }));
}

/** Planned files of the samples, under their own names */
function samples(...names) {
    return names.map((sample) => ({ sample }));
}

/**
 * One of demo's everyday collections, there to fill the Collections tab. Its
 * times are numbers of days before the seed, and its files sample names or
 * planned files.
 *
 * @param {{
 *   name: string,
 *   tags?: string[],
 *   created: number,
 *   added: number,
 *   opens?: number[],
 *   files: (string | PlannedFile)[]
 * }} collection
 * @returns {PlannedCollection}
 */
function everyday({ name, tags = [], created, added, opens = [], files }) {
    return {
        owner: "demo",
        name,
        tags,
        created: daysAgo(created),
        added: daysAgo(added),
        opens: opens.map((days) => daysAgo(days)),
        files: files.map((file) =>
            typeof file === "string" ? { sample: file } : file
        )
    };
}

/** The name a planned file is uploaded under */
export function fileName(file) {
    return file.name ?? SAMPLES[file.sample].name;
}
