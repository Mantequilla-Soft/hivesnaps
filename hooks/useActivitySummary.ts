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
}

/**
 * The Notifications activity summary: the chosen range, its counts, and a
 * tile filter for the list. The list loads 50 at a time, so a week or month
 * may reach past what's loaded; older pages are fetched until it's covered,
 * the history runs out, or MAX_BACKFILL_PAGES is reached.
 */
export function useActivitySummary({ notifications, hasMore, loadingMore, loadMore }: Options) {
    const [range, setRange] = useState<SummaryRange>('week');
    const [filter, setFilter] = useState<SummaryFilter | null>(null);
    const pagesFetched = useRef(0);

    useEffect(() => {
        pagesFetched.current = 0;
    }, [range]);

    const needsMore = range !== 'today' && hasMore && needsOlderPages(notifications, range);
    const backfilling = needsMore && pagesFetched.current < MAX_BACKFILL_PAGES;

    useEffect(() => {
        if (!needsMore || loadingMore || pagesFetched.current >= MAX_BACKFILL_PAGES) return;
        pagesFetched.current += 1;
        loadMore();
    }, [needsMore, loadingMore, loadMore, notifications]);

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
