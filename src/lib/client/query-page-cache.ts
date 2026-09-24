/** Pages of this many queries besides the one shown stay cached, the most recently shown ones */
const CACHED_QUERIES = 10;

/**
 * The loaded pages of the queries a screen is not showing, by query key, so
 * coming back to a query shows its pages again instead of starting over. Only
 * the most recently shown queries keep theirs.
 */
export class QueryPageCache<Page> {
    private readonly pages = new Map<string, Page[]>();

    constructor(private readonly size = CACHED_QUERIES) {}

    /**
     * Keeps the pages of the query being left and hands over the pages of the
     * one being shown, or none if it has none cached
     */
    swap(leaving: string, leavingPages: Page[], showing: string): Page[] {
        if (leavingPages.length > 0) this.pages.set(leaving, leavingPages);
        const pages = this.pages.get(showing) ?? [];
        this.pages.delete(showing);
        // The least recently shown queries go first
        const oldestFirst = Array.from(this.pages.keys());
        oldestFirst
            .slice(0, Math.max(0, oldestFirst.length - this.size))
            .forEach((key) => this.pages.delete(key));
        return pages;
    }

    /** Applies a change to every cached query's pages */
    change(change: (pages: Page[]) => Page[]) {
        this.pages.forEach((pages, key) => this.pages.set(key, change(pages)));
    }

    clear() {
        this.pages.clear();
    }
}
