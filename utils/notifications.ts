import { hiveCallWithFailover } from '../services/HiveClient';

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
 * Fetch notifications for a given account from Hive Bridge API
 */
export async function fetchNotifications(
  account: string,
  limit: number = 50
): Promise<HiveNotification[]> {
  try {
    const response = await fetch('https://api.hive.blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'bridge.account_notifications',
        params: { account, limit },
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
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
    timestamp: new Date(notification.date).getTime(),
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
 * Get unread notification count (assuming we store read status locally)
 */
export function getUnreadCount(notifications: ParsedNotification[]): number {
  return notifications.filter(n => !n.read).length;
}

export function sortNotifications(
  notifications: ParsedNotification[],
  sortBy: 'priority' | 'chronological' = 'chronological'
): ParsedNotification[] {
  return notifications.sort((a, b) => {
    if (sortBy === 'chronological') {
      // Pure chronological sorting: newest first, ignoring priority and read status
      return new Date(b.date).getTime() - new Date(a.date).getTime();
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
    return new Date(b.date).getTime() - new Date(a.date).getTime();
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

export function markAsRead(
  notifications: ParsedNotification[],
  notificationId: number
): ParsedNotification[] {
  return notifications.map(n =>
    n.id === notificationId ? { ...n, read: true } : n
  );
}

export function markAllAsRead(
  notifications: ParsedNotification[]
): ParsedNotification[] {
  return notifications.map(n => ({ ...n, read: true }));
}

export function formatNotificationTime(date: string): string {
  const notificationDate = new Date(date);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - notificationDate.getTime()) / (1000 * 60)
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
    return notificationDate.toLocaleDateString();
  }
}

export function isActionableNotification(
  notification: ParsedNotification
): boolean {
  return !!(notification.url && notification.targetContent);
}
