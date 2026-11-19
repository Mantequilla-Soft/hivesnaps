/**
 * Which snaps a feed tab shows, shared by the feed itself (useFeedData's
 * applyFilter) and the "N new snaps" banner, so the banner's count matches
 * what actually appears after tapping it.
 */
import { ModerationService, type ActiveVote } from '../services/ModerationService';

export type FeedFilter = 'following' | 'newest' | 'trending' | 'patrons';

export interface FilterableSnap {
    author: string;
    permlink: string;
    created: string;
    active_votes?: ActiveVote[];
}

/** Following / Patrons narrow by author; Newest and Trending show everyone. */
export function matchesFeedFilter(
    snap: Pick<FilterableSnap, 'author'>,
    filter: FeedFilter,
    followingSet: ReadonlySet<string>,
    patronSet: ReadonlySet<string>
): boolean {
    switch (filter) {
        case 'following':
            return followingSet.has(snap.author);
        case 'patrons':
            return patronSet.has(snap.author);
        default:
            return true;
    }
}

/** Hidden by an allowlisted moderator (cached verdict, or derived from active_votes when present). */
export function isModerationBlocked(snap: FilterableSnap): boolean {
    if (ModerationService.getCached(snap.author, snap.permlink)?.isBlocked) return true;
    if (Array.isArray(snap.active_votes)) {
        return !!ModerationService.fromActiveVotes(snap.author, snap.permlink, snap.active_votes)?.isBlocked;
    }
    return false;
}

const snapKey = (s: Pick<FilterableSnap, 'author' | 'permlink'>): string => `${s.author}/${s.permlink}`;

/**
 * Snaps in `latest` that are newer than anything already in the feed and
 * that the current tab would show. Hive `created` timestamps share one
 * fixed format ("2026-11-19T15:23:07"), so they compare as strings.
 *
 * @param known - snaps currently in the feed
 * @param isRelevant - tab filter + mutes + moderation for the current view
 * @param currentUser - your own snaps never count as "new"
 */
export function findNewSnaps<T extends FilterableSnap>(
    latest: readonly T[],
    known: readonly FilterableSnap[],
    isRelevant: (snap: T) => boolean,
    currentUser?: string | null
): T[] {
    if (known.length === 0) return [];
    let newest = '';
    const knownKeys = new Set<string>();
    for (const s of known) {
        knownKeys.add(snapKey(s));
        if (s.created > newest) newest = s.created;
    }
    const seen = new Set<string>();
    return latest
        .filter((s) => {
            const key = snapKey(s);
            if (seen.has(key)) return false;
            seen.add(key);
            return (
                s.created > newest &&
                !knownKeys.has(key) &&
                s.author !== currentUser &&
                isRelevant(s)
            );
        })
        .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
}
