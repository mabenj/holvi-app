// The scenario plan: what an empty demo is seeded with, as data. The seed
// signs up every User, then creates each collection for its owner, uploads
// its files, tags them, chooses its cover and records its Opens, and then
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
 *   files: PlannedFile[]
 * }} PlannedCollection a collection, created at `created`, whose files were
 *   all added at `added` (its Last added to). The client sends `added` as
 *   each file's last-modified time, which is also its taken time when it has
 *   no taken date of its own.
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
        files: samples("aegina-sunset.jpg")
    },
    {
        owner: "demo",
        name: "Aegina, October 2015",
        description: "A week on the island, out of season",
        tags: ["Greece", "Travel"],
        created: daysAgo(330),
        added: daysAgo(20),
        files: samples("aegina-sunset.jpg", "aegina-harbour-night.jpg")
    },
    {
        owner: "demo",
        name: "Wood Lake loons",
        description: "A summer morning in British Columbia",
        tags: ["Birds", "Canada"],
        created: daysAgo(300),
        added: daysAgo(290),
        files: samples("loons.mp4", "loons.mov")
    },
    {
        owner: "demo",
        name: "Old phone, 2019",
        description: "Copied off the old phone before it went to recycling",
        created: daysAgo(700),
        added: daysAgo(700),
        files: samples("labrador.jpg", "waterfall-glandieu.jpg", "tabby-cat.jpg")
    },
    {
        owner: "demo",
        name: "Mongolia 2023",
        description: "Two lakes in the north",
        tags: ["Travel", "Mongolia"],
        created: daysAgo(800),
        added: daysAgo(790),
        files: samples("lake-khovsgol.jpg", "lake-terkhiin-tsagaan.jpg")
    },
    {
        owner: "demo",
        name: "Clips to sort",
        description: "Straight off the phone",
        created: daysAgo(3),
        added: daysAgo(1),
        files: samples(
            "sea-foam.mov",
            "waterfall-vertical.mov",
            BROKEN_VIDEO
        )
    },
    everyday("Waterfalls", 200, 15, ["Water"], [
        "horseshoe-falls.jpg",
        "waterfall-glandieu.jpg",
        "waterfall-vertical.mp4"
    ]),
    everyday("Budapest weekend", 250, 250, ["Hungary", "Travel"], [
        "chain-bridge-budapest-night.jpg"
    ]),
    everyday("Spain 2014", 280, 100, ["Spain", "Travel"], [
        "beach-parasols-evening.jpg",
        "water-lily-alhambra.jpg",
        "paella.jpg"
    ]),
    everyday("Beach days", 120, 60, ["Beach"], [
        "beach-parasols-evening.jpg",
        "beach-steps.jpg",
        "dog-on-beach.jpg"
    ]),
    everyday("Denmark, Easter 2017", 310, 305, ["Denmark"], [
        "dog-on-beach.jpg",
        "beach-steps.jpg"
    ]),
    everyday("Swedish forests", 150, 140, ["Nature"], [
        "beech-and-ferns.jpg",
        "spruce-forest.jpg"
    ]),
    everyday("Autumn colours", 90, 10, ["Autumn"], [
        "rose-hips.jpg",
        "quebec-autumn.jpg",
        "monschau-autumn.jpg"
    ]),
    everyday("Snow days", 60, 5, ["Winter"], [
        "snowy-trees.jpg",
        "quebec-snow-fog.jpg",
        "red-fox-in-snow.jpg"
    ]),
    everyday("Cats", 350, 45, ["Pets"], [
        "cat-asleep-on-bench.jpg",
        "tabby-cat.jpg"
    ]),
    everyday("Dogs", 340, 200, ["Pets"], ["labrador.jpg", "dog-on-beach.jpg"]),
    everyday("Birds", 100, 95, ["Birds"], [
        "go-away-bird.jpg",
        "flamingos-sao-paulo-zoo.jpg"
    ]),
    everyday("Christmas 2011", 270, 270, ["Christmas", "Food"], [
        "buche-de-noel.jpg"
    ]),
    everyday("Food", 260, 30, ["Food"], ["paella.jpg", "buche-de-noel.jpg"]),
    everyday("Quebec City", 230, 225, ["Canada", "Travel"], [
        "quebec-snow-fog.jpg",
        "quebec-autumn.jpg"
    ]),
    everyday("Rio de Janeiro", 180, 180, ["Brazil", "Travel"], [
        "rio-sugarloaf-sunset.jpg"
    ]),
    everyday("Niagara Falls", 190, 185, ["Canada", "Water"], [
        "horseshoe-falls.jpg"
    ]),
    everyday("São Paulo Zoo", 175, 175, ["Brazil", "Birds"], [
        "flamingos-sao-paulo-zoo.jpg"
    ]),
    everyday("Monschau", 50, 48, ["Germany", "Autumn"], [
        "monschau-autumn.jpg"
    ]),
    everyday("Garden flowers", 110, 25, ["Flowers"], [
        "marigolds.jpg",
        "rose-hips.jpg",
        "water-lily-alhambra.jpg"
    ]),
    everyday("Sunsets", 160, 7, [], [
        "aegina-sunset.jpg",
        "rio-sugarloaf-sunset.jpg",
        "beach-parasols-evening.jpg"
    ]),
    everyday("Night photos", 140, 130, [], [
        "chain-bridge-budapest-night.jpg",
        "aegina-harbour-night.jpg"
    ]),
    everyday("Wildlife", 80, 4, ["Animals"], [
        "red-fox-in-snow.jpg",
        "go-away-bird.jpg",
        "loons.mp4"
    ]),
    everyday("Sea foam", 70, 70, ["Water"], ["sea-foam.mp4"]),
    everyday("Portrait videos", 40, 40, [], ["waterfall-vertical.mp4"]),
    everyday("Lakes", 130, 125, ["Water"], [
        "lake-khovsgol.jpg",
        "lake-terkhiin-tsagaan.jpg",
        "water-lily-alhambra.jpg"
    ]),
    everyday("Trees", 125, 50, ["Nature"], [
        "snowy-trees.jpg",
        "spruce-forest.jpg",
        "beech-and-ferns.jpg"
    ]),
    everyday("Bridges", 115, 115, [], ["chain-bridge-budapest-night.jpg"]),
    everyday("Harbours", 105, 105, ["Greece"], ["aegina-harbour-night.jpg"]),
    everyday("Winter 2021", 95, 95, ["Winter"], ["snowy-trees.jpg"]),
    everyday("Summer 2022", 85, 85, ["Flowers"], ["marigolds.jpg"]),
    everyday("Holiday 2023", 75, 72, ["Travel"], [
        "rio-sugarloaf-sunset.jpg",
        "lake-khovsgol.jpg"
    ]),
    everyday("Canada", 65, 12, ["Canada"], [
        "horseshoe-falls.jpg",
        "quebec-autumn.jpg",
        "loons.mp4"
    ]),
    everyday("Pets", 55, 3, ["Pets"], [
        "tabby-cat.jpg",
        "labrador.jpg",
        "cat-asleep-on-bench.jpg"
    ]),
    everyday("Greece", 45, 44, ["Greece"], ["aegina-sunset.jpg"]),
    everyday("Hungary", 35, 34, ["Hungary"], [
        "chain-bridge-budapest-night.jpg"
    ]),
    everyday("Brazil", 28, 27, ["Brazil"], [
        "rio-sugarloaf-sunset.jpg",
        "flamingos-sao-paulo-zoo.jpg"
    ]),
    everyday("Germany", 25, 24, ["Germany"], ["monschau-autumn.jpg"]),
    everyday("Japan", 22, 21, ["Japan"], ["waterfall-vertical.mp4"]),
    everyday("Water", 18, 17, ["Water"], [
        "sea-foam.mp4",
        "waterfall-glandieu.jpg"
    ]),
    everyday("Wallpapers", 16, 2, [], [
        "lake-terkhiin-tsagaan.jpg",
        "spruce-forest.jpg",
        "monschau-autumn.jpg"
    ]),
    everyday("Favourites 2025", 14, 6, [], [
        "go-away-bird.jpg",
        "monschau-autumn.jpg",
        "red-fox-in-snow.jpg"
    ]),
    everyday("Throwbacks", 11, 9, [], [
        "paella.jpg",
        "buche-de-noel.jpg",
        "chain-bridge-budapest-night.jpg"
    ]),
    everyday("France", 9, 8, ["France"], [
        "cat-asleep-on-bench.jpg",
        "waterfall-glandieu.jpg"
    ]),
    everyday("Print these", 6, 0.5, [], ["quebec-autumn.jpg", "labrador.jpg"])
];

/** Planned files of the samples, under their own names */
function samples(...names) {
    return names.map((sample) => ({ sample }));
}

/**
 * One of demo's everyday collections, there to fill the Collections tab:
 * created and added to the given numbers of days before the seed
 */
function everyday(name, createdDaysAgo, addedDaysAgo, tags, sampleNames) {
    return {
        owner: "demo",
        name,
        tags,
        created: daysAgo(createdDaysAgo),
        added: daysAgo(addedDaysAgo),
        files: samples(...sampleNames)
    };
}

/** The name a planned file is uploaded under */
export function fileName(file) {
    return file.name ?? SAMPLES[file.sample].name;
}
