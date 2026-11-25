/**
 * The activity summary at the top of Notifications (as on snapie.io's
 * NotificationsComp): counts of votes, replies, follows, mentions, reblogs
 * and transfers for Today, This Week or This Month.
 */
import { parseHiveDate, type HiveNotification } from './notifications';

export type SummaryRange = 'today' | 'week' | 'month';

export const SUMMARY_RANGES: { key: SummaryRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
];

export type SummaryFilter = 'votes' | 'replies' | 'follows' | 'mentions' | 'reblogs' | 'transfers';

const FILTER_TYPES: Record<SummaryFilter, string[]> = {
    votes: ['vote'],
    replies: ['reply', 'reply_comment'],
    follows: ['follow'],
    mentions: ['mention'],
    reblogs: ['reblog'],
    transfers: ['transfer'],
};

/** How each filter reads in "Showing only …". */
export const SUMMARY_FILTER_LABELS: Record<SummaryFilter, string> = {
    votes: 'votes',
    replies: 'replies',
    follows: 'new followers',
    mentions: 'mentions',
    reblogs: 'reblogs',
    transfers: 'transfers',
};

type SummaryNotification = Pick<HiveNotification, 'type' | 'date' | 'msg'> & { actionUser?: string };

export interface ActivitySummary {
    total: number;
    votes: number;
    uniqueVoters: number;
    /** Sum of the "($0.013)" amounts in vote messages, in USD. */
    earnings: number;
    replies: number;
    follows: number;
    mentions: number;
    reblogs: number;
    transfers: number;
}

/** Start of the range in ms: local midnight for Today, 7 days or 1 month back otherwise. */
export function rangeStart(range: SummaryRange, now: Date = new Date()): number {
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === 'week') start.setDate(start.getDate() - 7);
    else start.setMonth(start.getMonth() - 1);
    return start.getTime();
}

export function matchesSummaryFilter(n: Pick<HiveNotification, 'type'>, filter: SummaryFilter): boolean {
    return FILTER_TYPES[filter].includes(n.type);
}

const VOTE_AMOUNT = /\(\$([0-9]+(?:\.[0-9]+)?)\)/;
const ACTOR = /^@([a-z0-9.-]+)/;

export function computeActivitySummary(
    notifications: SummaryNotification[],
    range: SummaryRange,
    now: Date = new Date()
): ActivitySummary {
    const start = rangeStart(range, now);
    const inRange = notifications.filter((n) => parseHiveDate(n.date) >= start);
    const count = (filter: SummaryFilter): number => inRange.filter((n) => matchesSummaryFilter(n, filter)).length;

    const votes = inRange.filter((n) => n.type === 'vote');
    const voters = new Set(votes.map((n) => n.actionUser ?? ACTOR.exec(n.msg ?? '')?.[1]).filter(Boolean));
    const earnings = votes.reduce((sum, n) => {
        const match = VOTE_AMOUNT.exec(n.msg ?? '');
        return sum + (match ? parseFloat(match[1]) : 0);
    }, 0);

    return {
        total: inRange.length,
        votes: votes.length,
        uniqueVoters: voters.size,
        earnings: Math.round(earnings * 1000) / 1000,
        replies: count('replies'),
        follows: count('follows'),
        mentions: count('mentions'),
        reblogs: count('reblogs'),
        transfers: count('transfers'),
    };
}

export interface SummaryTile {
    filter: SummaryFilter;
    icon: 'arrow-up' | 'comment' | 'user-plus' | 'at' | 'repeat' | 'paper-plane';
    color: string;
    value: number;
    label: string;
    /** A second line, e.g. "5 voters". */
    detail?: string;
    /** Highlighted extra, e.g. "$0.42". */
    sub?: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One tile per kind of activity that happened in the range, in snapie.io's order. */
export function summaryTiles(summary: ActivitySummary): SummaryTile[] {
    const tiles: (SummaryTile | false)[] = [
        summary.votes > 0 && {
            filter: 'votes',
            icon: 'arrow-up',
            color: '#17BF63',
            value: summary.votes,
            label: summary.votes === 1 ? 'Vote' : 'Votes',
            detail: plural(summary.uniqueVoters, 'voter', 'voters'),
            sub: summary.earnings > 0 ? `$${summary.earnings.toFixed(2)}` : undefined,
        },
        summary.replies > 0 && {
            filter: 'replies',
            icon: 'comment',
            color: '#1DA1F2',
            value: summary.replies,
            label: summary.replies === 1 ? 'Reply' : 'Replies',
        },
        summary.follows > 0 && {
            filter: 'follows',
            icon: 'user-plus',
            color: '#8E44AD',
            value: summary.follows,
            label: summary.follows === 1 ? 'New follower' : 'New followers',
        },
        summary.mentions > 0 && {
            filter: 'mentions',
            icon: 'at',
            color: '#F4900C',
            value: summary.mentions,
            label: summary.mentions === 1 ? 'Mention' : 'Mentions',
        },
        summary.reblogs > 0 && {
            filter: 'reblogs',
            icon: 'repeat',
            color: '#16A5A5',
            value: summary.reblogs,
            label: summary.reblogs === 1 ? 'Reblog' : 'Reblogs',
        },
        summary.transfers > 0 && {
            filter: 'transfers',
            icon: 'paper-plane',
            color: '#E0457B',
            value: summary.transfers,
            label: summary.transfers === 1 ? 'Transfer' : 'Transfers',
        },
    ];
    return tiles.filter((t): t is SummaryTile => !!t);
}

/**
 * True while the loaded list may not reach back to the start of the range:
 * its oldest item is still inside it. (Notifications are newest first.)
 */
export function needsOlderPages(
    notifications: Pick<HiveNotification, 'date'>[],
    range: SummaryRange,
    now: Date = new Date()
): boolean {
    const oldest = notifications[notifications.length - 1];
    if (!oldest) return false;
    return parseHiveDate(oldest.date) >= rangeStart(range, now);
}
