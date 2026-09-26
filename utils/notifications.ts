import { Client, PrivateKey, Operation } from '@hiveio/dhive';
import { getCurrentNode, hiveCall } from '../services/HiveClient';

export interface HiveNotification {
  id: number;
  type: string;
  score: number;
  date: string;
  msg: string;
  url: string;
  read?: boolean;
  timestamp?: number;
}

export interface UnreadNotificationState {
  lastread: string;
  unread: number;
}

/**
 * Hive bridge dates are UTC but come back without a trailing 'Z'
 * (e.g. "2024-01-01T12:00:00"). Parsing that directly makes JS treat it
 * as local time, which silently shifts every comparison by the device's
 * UTC offset — exactly the bug that would make the read/unread cursor
 * below compare wrong. Always go through this before comparing dates.
 */
export function parseHiveDate(dateString?: string): number {
  if (!dateString) return 0;
  const iso = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  return new Date(iso).getTime();
}

export interface ParsedNotification extends HiveNotification {
  actionUser?: string;
  targetContent?: {
    author: string;
    permlink: string;
  };
  amount?: string;
  icon: string;
  color: string;
  actionText: string;
}

/**
 * Fetch notifications for a given account from Hive Bridge API.
 *
 * Pass `lastId` (the `id` of the oldest notification already loaded) to
 * page backwards in time — this is `bridge.account_notifications`'
 * standard cursor param. Without it, always returns the newest page,
 * which is why this used to feel capped at `limit`.
 */
export async function fetchNotifications(
  account: string,
  limit: number = 50,
  lastId?: number
): Promise<HiveNotification[]> {
  try {
    const params: Record<string, string | number> = { account, limit };
    if (lastId !== undefined) params.last_id = lastId;

    const data = await hiveCall(async () => {
      const response = await fetch(getCurrentNode(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'bridge.account_notifications',
          params,
          id: 1,
        }),
      });
      return response.json();
    });
    return data.result || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Fetch the account's read cursor from Hive itself: `lastread` is the
 * timestamp the account (or any app it used) last acknowledged, and
 * `unread` is Hive's own count of notifications since then. This is the
 * same state PeakD/Ecency/hive.blog read and write, via
 * `bridge.unread_notifications` — using it (instead of a local read-ID
 * list) is what makes read status sync across apps and devices.
 */
export async function fetchUnreadNotificationState(
  account: string
): Promise<UnreadNotificationState> {
  try {
    const data = await hiveCall(async () => {
      const response = await fetch(getCurrentNode(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'bridge.unread_notifications',
          params: { account },
          id: 1,
        }),
      });
      return response.json();
    });
    return data.result || { lastread: '1970-01-01T00:00:00', unread: 0 };
  } catch (error) {
    console.error('Error fetching unread notification state:', error);
    return { lastread: '1970-01-01T00:00:00', unread: 0 };
  }
}

/**
 * Marks notifications read up through `throughDate` by broadcasting Hive's
 * native read-cursor operation: a `custom_json` with id `notify` and
 * payload `['setLastRead', { date }]`, signed with the posting key. This
 * is a real transaction (costs a sliver of RC) — call it for explicit user
 * actions (mark read / mark all read), not automatically on every render.
 */
export async function broadcastSetLastRead(
  client: Client,
  username: string,
  postingKey: PrivateKey,
  throughDate: string
): Promise<void> {
  const op: Operation = [
    'custom_json',
    {
      required_auths: [],
      required_posting_auths: [username],
      id: 'notify',
      json: JSON.stringify(['setLastRead', { date: throughDate }]),
    },
  ];
  await client.broadcast.sendOperations([op], postingKey);
}

/**
 * Parse notification message to extract key information
 */
export function parseNotification(
  notification: HiveNotification
): ParsedNotification {
  const parsed: ParsedNotification = {
    ...notification,
    icon: 'bell',
    color: '#1DA1F2',
    actionText: 'Activity',
    timestamp: parseHiveDate(notification.date),
  };

  // Parse different notification types
  switch (notification.type) {
    case 'vote':
      parsed.icon = 'arrow-up';
      parsed.color = '#17BF63';
      parsed.actionText = 'Upvoted';

      // Extract voter and amount from message like "@alice voted on your post ($0.013)"
      const voteMatch = notification.msg.match(
        /@([a-z0-9.-]+) voted on your post \(\$([0-9.]+)\)/
      );
      if (voteMatch) {
        parsed.actionUser = voteMatch[1];
        parsed.amount = `$${voteMatch[2]}`;
      }
      break;

    case 'reply':
      parsed.icon = 'comment';
      parsed.color = '#1DA1F2';
      parsed.actionText = 'Replied to';

      // Extract replier from message like "@bob replied to your post"
      const replyMatch = notification.msg.match(
        /@([a-z0-9.-]+) replied to your/
      );
      if (replyMatch) {
        parsed.actionUser = replyMatch[1];
      }
      break;

    case 'reblog':
      parsed.icon = 'repeat';
      parsed.color = '#17BF63';
      parsed.actionText = 'Reblogged';

      // Extract reblogger from message like "@charlie reblogged your post"
      const reblogMatch = notification.msg.match(
        /@([a-z0-9.-]+) reblogged your/
      );
      if (reblogMatch) {
        parsed.actionUser = reblogMatch[1];
      }
      break;

    case 'follow':
      parsed.icon = 'user-plus';
      parsed.color = '#1DA1F2';
      parsed.actionText = 'Started following you';

      // Extract follower from message like "@dave followed you" or "@dave started following you"
      const followMatch = notification.msg.match(
        /@([a-z0-9.-]+) (?:followed|started following) you/
      );
      if (followMatch) {
        parsed.actionUser = followMatch[1];
      } else if (notification.url && notification.url.startsWith('@')) {
        // Fallback: extract username from URL field like "@ankapolo"
        parsed.actionUser = notification.url.substring(1);
      }
      break;

    case 'mention':
      parsed.icon = 'at';
      parsed.color = '#F4900C';
      parsed.actionText = 'Mentioned you';

      // Extract mentioner from message like "@eve mentioned you in a post"
      const mentionMatch = notification.msg.match(
        /@([a-z0-9.-]+) mentioned you/
      );
      if (mentionMatch) {
        parsed.actionUser = mentionMatch[1];
      }
      break;

    case 'subscribe':
      parsed.icon = 'bell';
      parsed.color = '#17BF63';
      parsed.actionText = 'Subscribed to community';
      break;

    case 'set_role':
      parsed.icon = 'shield';
      parsed.color = '#8e44ad';
      parsed.actionText = 'Role updated';
      break;

    case 'set_label':
      parsed.icon = 'tag';
      parsed.color = '#9b59b6';
      parsed.actionText = 'Label assigned';
      break;

    case 'new_community':
      parsed.icon = 'users';
      parsed.color = '#2ecc71';
      parsed.actionText = 'New community created';
      break;

    default:
      parsed.icon = 'bell';
      parsed.color = '#95a5a6';
      parsed.actionText = 'Activity';
      break;
  }

  // Extract target content information from URL
  if (notification.url) {
    const urlMatch = notification.url.match(/@([a-z0-9.-]+)\/([a-z0-9-]+)/);
    if (urlMatch) {
      parsed.targetContent = {
        author: urlMatch[1],
        permlink: urlMatch[2],
      };
    }
  }

  return parsed;
}

/**
 * Get notification count for an account
 */
export async function getNotificationCount(account: string): Promise<number> {
  try {
    const notifications = await fetchNotifications(account, 100);
    return notifications.length;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
}

/**
 * Stamps each notification's `read` flag from Hive's read cursor
 * (`date <= lastRead`) instead of a locally-stored ID list — the cursor
 * is the single source of truth for read/unread.
 */
export function applyReadCursor(
  notifications: ParsedNotification[],
  lastRead: string
): ParsedNotification[] {
  const cursor = parseHiveDate(lastRead);
  return notifications.map(n => ({
    ...n,
    read: parseHiveDate(n.date) <= cursor,
  }));
}

export function sortNotifications(
  notifications: ParsedNotification[],
  sortBy: 'priority' | 'chronological' = 'chronological'
): ParsedNotification[] {
  return notifications.sort((a, b) => {
    if (sortBy === 'chronological') {
      // Pure chronological sorting: newest first, ignoring priority and read status
      return parseHiveDate(b.date) - parseHiveDate(a.date);
    }
    // Legacy priority-based sorting (groups notifications by type)
    // First sort by read status (unread first)
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }
    // Then by priority
    const priorityDiff =
      getNotificationPriority(b) - getNotificationPriority(a);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // Finally by date (newest first)
    return parseHiveDate(b.date) - parseHiveDate(a.date);
  });
}

export function getDefaultNotificationSettings() {
  return {
    votes: true,
    replies: true,
    reblogs: true,
    follows: true,
    mentions: true,
    communityUpdates: true,
    pushNotifications: false,
    emailNotifications: false,
  };
}

export function filterNotificationsBySettings(
  notifications: ParsedNotification[],
  settings: ReturnType<typeof getDefaultNotificationSettings>
): ParsedNotification[] {
  return notifications.filter(notification => {
    let shouldInclude: boolean;
    switch (notification.type) {
      case 'vote':
        shouldInclude = settings.votes;
        break;
      case 'reply':
      case 'reply_comment':
        shouldInclude = settings.replies;
        break;
      case 'reblog':
        shouldInclude = settings.reblogs;
        break;
      case 'follow':
        shouldInclude = settings.follows;
        break;
      case 'mention':
        shouldInclude = settings.mentions;
        break;
      case 'subscribe':
      case 'set_role':
      case 'set_label':
      case 'new_community':
        shouldInclude = settings.communityUpdates;
        break;
      default:
        shouldInclude = true;
        break;
    }
    
    return shouldInclude;
  });
}

export function getNotificationPriority(
  notification: ParsedNotification
): number {
  const priorities: Record<string, number> = {
    mention: 10,
    reply: 9,
    vote: 8,
    follow: 7,
    reblog: 6,
    set_role: 5,
    set_label: 4,
    subscribe: 3,
    new_community: 2,
  };
  return priorities[notification.type] || 1;
}

export function formatNotificationTime(date: string): string {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - parseHiveDate(date)) / (1000 * 60)
  );
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else if (diffInMinutes < 10080) {
    // 7 days
    const days = Math.floor(diffInMinutes / 1440);
    return `${days}d ago`;
  } else {
    return new Date(parseHiveDate(date)).toLocaleDateString();
  }
}

export function isActionableNotification(
  notification: ParsedNotification
): boolean {
  return !!(notification.url && notification.targetContent);
}
