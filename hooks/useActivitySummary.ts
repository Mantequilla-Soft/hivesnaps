import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedNotification } from '../utils/notifications';
import {
    computeActivitySummary,
    matchesSummaryFilter,
    needsOlderPages,
    summaryTiles,
    type SummaryFilter,
    type SummaryRange,
} from '../utils/notificationSummary';

/** Most older pages (50 each) to fetch just to cover a range. */
export const MAX_BACKFILL_PAGES = 20;

interface Options {
    notifications: ParsedNotification[];
    hasMore: boolean;
    loadingMore: boolean;
    loadMore: () => Promise<void>;
    /** Changes whenever the list is replaced (a refresh), which restarts the page budget. */
    listVersion: number;
}

/**
 * The Notifications activity summary: the chosen range, its counts, and a
 * tile filter for the list. The list loads 50 at a time, so the range may
 * reach past what's loaded; older pages are fetched until it's covered, the
 * history runs out, or MAX_BACKFILL_PAGES have been fetched for this range
 * and this list.
 */
export function useActivitySummary({ notifications, hasMore, loadingMore, loadMore, listVersion }: Options) {
    const [range, setRange] = useState<SummaryRange>('week');
    const [filter, setFilter] = useState<SummaryFilter | null>(null);

    // Pages fetched for the current range and list. Keyed so that a new
    // range or a refreshed list starts from a full budget in the same render.
    const budgetKey = `${range}|${listVersion}`;
    const budget = useRef({ key: budgetKey, used: 0 });
    if (budget.current.key !== budgetKey) budget.current = { key: budgetKey, used: 0 };

    const needsMore = hasMore && needsOlderPages(notifications, range);
    const backfilling = needsMore && budget.current.used < MAX_BACKFILL_PAGES;

    useEffect(() => {
        if (!backfilling || loadingMore) return;
        budget.current.used += 1;
        loadMore();
        // budgetKey: a new range or a refreshed list re-checks even when nothing else changed.
    }, [backfilling, loadingMore, loadMore, notifications, budgetKey]);

    const summary = useMemo(() => computeActivitySummary(notifications, range), [notifications, range]);
    const tiles = useMemo(() => summaryTiles(summary), [summary]);
    const visible = useMemo(
        () => (filter ? notifications.filter((n) => matchesSummaryFilter(n, filter)) : notifications),
        [notifications, filter]
    );

    /** Tap a tile to show only that kind; tap it again to show everything. */
    const toggleFilter = (next: SummaryFilter): void => setFilter((current) => (current === next ? null : next));

    return { range, setRange, summary, tiles, backfilling, filter, setFilter, toggleFilter, visible };
}
