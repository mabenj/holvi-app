# All browsing is server-side, paged with keyset cursors

The home page used to download every collection joined to every file row. It then sorted, filtered and built thumbnails in the browser, so the whole library went over the wire before anything was shown. Now all sorting, filtering and search for collections, a collection's files and the Timeline happen on the server. Results come a page at a time behind opaque keyset cursors, with the id as the final tie-break for every sort. The collection listing returns compact summaries: counts from SQL aggregates, at most 10 thumbnails, and only the Cover's blur placeholder.

## Considered Options

- **Offset pagination**: pages shift when collections change or Opens reorder them, and deep pages get slower.
- **A slimmer full listing, sorted in the browser**: still grows with the library. The opened-based sorts and the forgotten filter need server data anyway.

## Consequences

- Every new sort or filter needs a query that works with keyset cursors, plus an index to support it.
- Going back restores the cached pages first and then the scroll position.
- Only the Timeline is virtualized. The Collections grid and collection pages paginate without virtualization.
