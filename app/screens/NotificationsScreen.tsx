import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Image,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Modal from 'react-native-modal';
import { getTheme, palette } from '../../constants/Colors';
import { useCurrentUser } from '../../store/context';

import {
  formatNotificationTime,
  isActionableNotification,
  type ParsedNotification,
} from '../../utils/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import { detectPostType, type PostInfo } from '../../utils/postTypeDetector';
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

interface NotificationItemProps {
  notification: ParsedNotification;
  onPress: (notification: ParsedNotification) => void;
  onMarkAsRead: (id: number) => void;
  isDark: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onMarkAsRead,
  isDark,
}) => {
  // Compute theme once per render
  const theme = getTheme(isDark ? 'dark' : 'light');

  // Convert UTC timestamp to local time before formatting
  const rawTimestamp = notification.date;
  // Parse as UTC and let JS handle local conversion
  const localDate =
    typeof rawTimestamp === 'string'
      ? new Date(rawTimestamp + 'Z')
      : new Date(rawTimestamp);
  const translatedTimestamp = formatNotificationTime(localDate.toISOString());

  const handlePress = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onPress(notification);
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: notification.read
            ? theme.background
            : isDark
              ? palette.darkBubbleHighlight
              : palette.lightBackgroundHighlight,
          borderBottomColor: theme.border,
        },
      ]}
      onPress={handlePress}
      disabled={
        !isActionableNotification(notification) &&
        notification.type !== 'follow'
      }
    >
      <View style={styles.notificationHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: notification.color + '20' },
          ]}
        >
          <FontAwesome
            name={notification.icon as any}
            size={20}
            color={notification.color}
          />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationTop}>
            <Text
              style={[
                styles.notificationMessage,
                {
                  color: theme.text,
                  fontWeight: notification.read ? 'normal' : '600',
                },
              ]}
              numberOfLines={2}
            >
              {notification.msg}
            </Text>
            {!notification.read && (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: notification.color },
                ]}
              />
            )}
          </View>
          <View style={styles.notificationBottom}>
            <Text
              style={[
                styles.timeText,
                { color: theme.textSecondary },
              ]}
            >
              {translatedTimestamp}
            </Text>
            {notification.amount && (
              <Text style={[styles.amountText, { color: palette.success }]}>
                {notification.amount}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const NotificationsScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Get current user from context (managed by PIN system)
  const currentUsername = useCurrentUser();
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Use the notifications hook which handles settings persistence
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    settings,
    refresh,
    markAsRead,
    markAllAsRead,
    updateSettings,
  } = useNotifications(currentUsername);

  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    subtext: theme.textSecondary,
    border: theme.border,
    cardBackground: isDark ? palette.darkBubbleHighlight : palette.lightBubble,
    buttonBackground: theme.button,
  };

  // The useNotifications hook handles loading notifications when username changes

  const handleNotificationPress = async (notification: ParsedNotification) => {
    console.log('[NotificationsScreen] handleNotificationPress called:', {
      notificationType: notification.type,
      actionUser: notification.actionUser,
      targetContent: notification.targetContent,
      isActionable: isActionableNotification(notification),
    });

    // Handle follower notifications - navigate to the follower's profile
    if (notification.type === 'follow' && notification.actionUser) {
      console.log(
        '[NotificationsScreen] Navigating to ProfileScreen for follow notification'
      );
      router.push(`/screens/ProfileScreen?username=${notification.actionUser}`);
      return;
    }

    // Handle other actionable notifications - navigate to post/comment
    if (isActionableNotification(notification) && notification.targetContent) {
      console.log('[NotificationsScreen] Fetching post data for navigation:', {
        author: notification.targetContent.author,
        permlink: notification.targetContent.permlink,
      });

      try {
        // Fetch the post data to determine if it's a snap or regular Hive post
        const postData = await client.database.call('get_content', [
          notification.targetContent.author,
          notification.targetContent.permlink,
        ]);

        console.log('[NotificationsScreen] Post data received:', {
          hasPostData: !!postData,
          author: postData?.author,
          permlink: postData?.permlink,
          title: postData?.title,
          parent_author: postData?.parent_author,
          json_metadata: postData?.json_metadata ? 'present' : 'missing',
        });

        if (postData && postData.author) {
          const postInfo: PostInfo = {
            author: postData.author,
            permlink: postData.permlink,
            title: postData.title,
            body: postData.body,
            json_metadata: postData.json_metadata,
            parent_author: postData.parent_author,
            parent_permlink: postData.parent_permlink,
          };

          console.log('[NotificationsScreen] Post info for detection:', {
            author: postInfo.author,
            permlink: postInfo.permlink,
            parent_author: postInfo.parent_author,
            hasMetadata: !!postInfo.json_metadata,
          });

          const postType = await detectPostType(postInfo);
          console.log('[NotificationsScreen] Post type detected:', postType);

          if (postType === 'snap') {
            console.log(
              '[NotificationsScreen] Navigating to ConversationScreen (snap)'
            );
            router.push({
              pathname: '/screens/ConversationScreen',
              params: {
                author: postData.author,
                permlink: postData.permlink,
              },
            });
          } else {
            console.log(
              '[NotificationsScreen] Navigating to HivePostScreen (regular post)'
            );
            router.push({
              pathname: '/screens/HivePostScreen',
              params: {
                author: postData.author,
                permlink: postData.permlink,
              },
            });
          }
        } else {
          console.log('[NotificationsScreen] Post not found, showing error');
          // Show an error instead of navigating to a broken screen
          Alert.alert(
            'Post Not Found',
            "The post you're trying to view could not be found. It may have been deleted or the link may be invalid.",
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error(
          '[NotificationsScreen] Error fetching post data for navigation:',
          error
        );
        // Show an error instead of navigating to a broken screen
        Alert.alert(
          'Error Loading Post',
          'There was an error loading the post. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } else {
      console.log(
        '[NotificationsScreen] Notification not actionable or missing target content'
      );
    }
  };

  const handleMarkAsRead = useCallback(
    async (notificationId: number) => {
      await markAsRead(notificationId);
    },
    [markAsRead]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const handleRefresh = () => {
    refresh();
  };

  const renderNotification = ({ item }: { item: ParsedNotification }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onMarkAsRead={handleMarkAsRead}
      isDark={isDark}
    />
  );

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name='arrow-left' size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications
        </Text>
      </View>
      <View style={styles.headerRight}>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markAllButton}
          >
            <Text
              style={[styles.markAllText, { color: colors.buttonBackground }]}
            >
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          style={styles.settingsButton}
        >
          <FontAwesome name='cog' size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <FontAwesome name='bell-o' size={64} color={colors.subtext} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No notifications
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );

  const renderSettings = () => (
    <Modal
      isVisible={settingsVisible}
      onBackdropPress={() => setSettingsVisible(false)}
      onBackButtonPress={() => setSettingsVisible(false)}
      style={styles.modalStyle}
    >
      <View
        style={[styles.settingsModal, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.settingsHeader, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.settingsTitle, { color: colors.text }]}>
            Notification Settings
          </Text>
          <TouchableOpacity onPress={() => setSettingsVisible(false)}>
            <FontAwesome name='times' size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingsContent}>
          {[
            { key: 'votes', label: 'Votes on my posts', icon: 'arrow-up' },
            { key: 'replies', label: 'Replies to my posts', icon: 'comment' },
            { key: 'reblogs', label: 'Reblogs of my posts', icon: 'repeat' },
            { key: 'follows', label: 'New followers', icon: 'user-plus' },
            { key: 'mentions', label: 'Mentions', icon: 'at' },
            {
              key: 'communityUpdates',
              label: 'Community updates',
              icon: 'users',
            },
          ].map(({ key, label, icon }) => (
            <View
              key={key}
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
            >
              <View style={styles.settingLeft}>
                <FontAwesome name={icon as any} size={20} color={colors.text} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {label}
                </Text>
              </View>
              <Switch
                value={settings[key as keyof typeof settings] as boolean}
                onValueChange={value => updateSettings({ [key]: value })}
                trackColor={{
                  false: colors.border,
                  true: colors.buttonBackground + '50',
                }}
                thumbColor={colors.buttonBackground}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.buttonBackground },
          ]}
          onPress={() => {
            setSettingsVisible(false);
            // Settings are automatically saved when toggled, so just refresh
            refresh();
          }}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  if (!currentUsername) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.subtext }]}>
            Please log in to view notifications
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {renderHeader()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.buttonBackground} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.buttonBackground}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyContainer : undefined
          }
        />
      )}

      {renderSettings()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  markAllButton: {
    marginRight: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 4,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  notificationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 13,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalStyle: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  settingsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsContent: {
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  saveButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
