# Collections open in a random order derived from the Shuffle period

With about a thousand collections in a fixed order, most are never seen. So the Collections tab defaults to a random order, meant for rediscovery. The order is seeded from a hash of the user id and the index of the current Shuffle period, so it stays the same within a period (an hour by default, `HOLVI_SHUFFLE_PERIOD_MINUTES`) and changes by itself when the next period starts. The server returns the seed. The client keeps it in memory only and passes it back for every further page and for navigation back from a collection. This keeps one continuous scroll in a consistent order even if the period ends mid-scroll. A reload, pull-to-refresh or a tap on the active Collections tab drops the seed.

## Considered Options

- **A fresh random order per request**: pages would overlap or skip collections, and going back would lose the user's place.
- **A seed kept in the URL or browser storage**: the order would freeze until cleared, which defeats rediscovery.
- **A manual re-shuffle button**: rejected by the user. The order changes on its own and the screen stays uncluttered.
- **Shuffling in the browser**: needs the whole library up front, which the paginated browsing in [0003](./0003-server-side-browsing-with-cursor-pagination.md) rules out.

## Consequences

Within a Shuffle period, pull-to-refresh returns the same order by design, so the random order changes at most once per period.
