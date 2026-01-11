import React from 'react';
import { SafeAreaView as SafeAreaViewSA } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  Image,
  ScrollView,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createProfileScreenStyles } from '../../styles/ProfileScreenStyles';
import Snap from '../components/Snap';
import UpvoteModal from '../../components/UpvoteModal';
// ContentModal removed - now using ComposeScreen for edit

// Import custom hooks
import { useProfileData } from '../../hooks/useProfileData';
import { useFollowManagement } from '../../hooks/useFollowManagement';
import { useUserSnaps } from '../../hooks/useUserSnaps';
import { useAvatarManagement } from '../../hooks/useAvatarManagement';
import { useRewardsManagement } from '../../hooks/useRewardsManagement';
import { useAuth } from '../../store/context';
import { useUpvote } from '../../hooks/useUpvote';
import { useHiveData } from '../../hooks/useHiveData';
// useEdit removed - now using ComposeScreen for edit

const ProfileScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams();

  // Debug the params object
  console.log('ProfileScreen params:', params);
  console.log('ProfileScreen params.username:', params.username);
  console.log('ProfileScreen params type:', typeof params.username);

  // Get username from params
  const username = params.username as string | undefined;

  // Use custom hooks
  const { currentUsername, handleLogout } = useAuth();

  // Define isOwnProfile early to avoid undefined issues
  const isOwnProfile = currentUsername === username;
  const {
    profile,
    loading,
    globalProps,
    refetch: refetchProfile,
  } = useProfileData(username);

  // Debug logging
  console.log('ProfileScreen Debug:', {
    username,
    currentUsername,
    isOwnProfile,
    profile,
    loading,
  });
  const { hivePrice, rewardFund } = useHiveData();
  const {
    isFollowing,
    isMuted,
    followLoading,
    muteLoading,
    handleFollow,
    handleUnfollow,
    handleMute,
    handleUnmute,
  } = useFollowManagement(currentUsername, username);
  const {
    userSnaps,
    snapsLoading,
    snapsError,
    snapsLoaded,
    displayedSnapsCount,
    loadMoreLoading,
    fetchUserSnaps,
    loadMoreSnaps,
    convertUserSnapToSnapProps,
    updateSnap,
  } = useUserSnaps(username);
  const {
    editAvatarModalVisible,
    newAvatarImage,
    avatarUploading,
    avatarUpdateLoading,
    avatarUpdateSuccess,
    activeKeyModalVisible,
    activeKeyInput,
    setActiveKeyInput,
    handleEditAvatarPress,
    handleSelectNewAvatar,
    handleNextStep,
    handleUpdateAvatar,
    closeModals,
  } = useAvatarManagement(currentUsername);
  const { claimLoading, processing, handleClaimRewards } = useRewardsManagement(
    currentUsername,
    profile,
    isOwnProfile,
    refetchProfile
  );
  const {
    upvoteModalVisible,
    voteWeight,
    voteWeightLoading,
    upvoteLoading,
    upvoteSuccess,
    voteValue,
    openUpvoteModal,
    closeUpvoteModal,
    confirmUpvote,
    setVoteWeight,
  } = useUpvote(
    currentUsername,
    globalProps,
    rewardFund,
    hivePrice,
    updateSnap
  );

  // Removed useEdit hook - now using ComposeScreen for edit

  // Initialize styles
  const styles = createProfileScreenStyles(isDark);

  // Colors for JSX elements (using the same theme as styles)
  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    bubble: isDark ? '#22303C' : '#f7f9f9',
    border: isDark ? '#38444D' : '#eee',
    icon: '#1DA1F2',
    payout: '#17BF63',
    button: '#1DA1F2',
    buttonText: '#fff',
    buttonInactive: isDark ? '#22303C' : '#E1E8ED',
    mutedButton: '#E74C3C',
    followButton: '#1DA1F2',
    unfollowButton: '#8B9DC3',
  };

  // Helper function to convert VESTS to Hive Power (needed for UI display)
  const vestsToHp = (
    vests: number,
    totalVestingFundHive: any,
    totalVestingShares: any
  ): number => {
    const totalVestingFundHiveStr =
      typeof totalVestingFundHive === 'string'
        ? totalVestingFundHive
        : totalVestingFundHive.toString();
    const totalVestingSharesStr =
      typeof totalVestingShares === 'string'
        ? totalVestingShares
        : totalVestingShares.toString();

    const totalVestingFundHiveNum = parseFloat(
      totalVestingFundHiveStr.replace(' HIVE', '')
    );
    const totalVestingSharesNum = parseFloat(
      totalVestingSharesStr.replace(' VESTS', '')
    );

    if (totalVestingSharesNum === 0) {
      return 0;
    }

    const hivePerVests = totalVestingFundHiveNum / totalVestingSharesNum;
    const hp = vests * hivePerVests;

    return hp;
  };

  // Handle snap bubble press (navigate to conversation)
  const handleSnapPress = (snap: any) => {
    router.push({
      pathname: '/screens/ConversationScreen',
      params: {
        author: snap.author,
        permlink: snap.permlink,
      },
    });
  };

  // Handle reply to profile snap bubble
  const handleSnapReply = (snap: any) => {
    router.push({
      pathname: '/screens/ConversationScreen',
      params: {
        author: snap.author,
        permlink: snap.permlink,
      },
    });
  };

  // Handle edit press
  const handleEditPress = (snapData: {
    author: string;
    permlink: string;
    body: string;
  }) => {
    router.push({
      pathname: '/screens/ComposeScreen',
      params: {
        mode: 'edit',
        parentAuthor: snapData.author,
        parentPermlink: snapData.permlink,
        initialText: snapData.body
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  if (!username) {
    return (
      <SafeAreaViewSA style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: No username provided</Text>
        </View>
      </SafeAreaViewSA>
    );
  }

  return (
    <SafeAreaViewSA style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <FontAwesome name='arrow-left' size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <FontAwesome
            name='hourglass-half'
            size={48}
            color={colors.icon}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : profile ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Info Section */}
          <View style={styles.profileSection}>
            {/* Username */}
            <Text style={[styles.username, { color: colors.text }]}>
              @{profile.username}
            </Text>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {profile.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.largeAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.largeAvatar,
                    styles.defaultAvatar,
                    { backgroundColor: colors.bubble },
                  ]}
                >
                  <FontAwesome name='user' size={60} color={colors.icon} />
                </View>
              )}
            </View>

            {/* Edit Profile Image Button (Only for own profile) */}
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.editAvatarButton}
                onPress={handleEditAvatarPress}
              >
                <FontAwesome name='camera' size={16} color={colors.icon} />
                <Text style={[styles.editAvatarText, { color: colors.icon }]}>
                  Edit Profile Image
                </Text>
              </TouchableOpacity>
            )}

            {/* Display Name */}
            {profile.displayName && (
              <Text style={[styles.displayName, { color: colors.text }]}>
                {profile.displayName}
              </Text>
            )}

            {/* Follower/Following Counts */}
            <View style={styles.socialStats}>
              <View style={styles.socialStatItem}>
                <Text style={[styles.socialStatNumber, { color: colors.text }]}>
                  {(profile.followersCount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.socialStatLabel, { color: colors.text }]}>
                  Followers
                </Text>
              </View>
              <View style={styles.socialStatItem}>
                <Text style={[styles.socialStatNumber, { color: colors.text }]}>
                  {(profile.followingCount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.socialStatLabel, { color: colors.text }]}>
                  Following
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {isFollowing ? (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.unfollowButton,
                        opacity: followLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleUnfollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color='#fff'
                      />
                    ) : (
                      <FontAwesome name='user-times' size={16} color='#fff' />
                    )}
                    <Text style={styles.buttonText}>
                      {followLoading ? 'Unfollowing...' : 'Unfollow'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.followButton,
                        opacity: followLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color='#fff'
                      />
                    ) : (
                      <FontAwesome name='user-plus' size={16} color='#fff' />
                    )}
                    <Text style={styles.buttonText}>
                      {followLoading ? 'Following...' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isMuted ? (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.buttonInactive,
                        opacity: muteLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleUnmute}
                    disabled={muteLoading}
                  >
                    {muteLoading ? (
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color={colors.text}
                      />
                    ) : (
                      <FontAwesome
                        name='volume-up'
                        size={16}
                        color={colors.text}
                      />
                    )}
                    <Text style={[styles.buttonText, { color: colors.text }]}>
                      {muteLoading ? 'Unblocking...' : 'Unblock'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: colors.mutedButton,
                        opacity: muteLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleMute}
                    disabled={muteLoading}
                  >
                    {muteLoading ? (
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color='#fff'
                      />
                    ) : (
                      <FontAwesome name='volume-off' size={16} color='#fff' />
                    )}
                    <Text style={styles.buttonText}>
                      {muteLoading ? 'Blocking...' : 'Block'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* About Section */}
            {profile.about && (
              <View style={styles.aboutSection}>
                <Text style={[styles.aboutText, { color: colors.text }]}>
                  {profile.about}
                </Text>
              </View>
            )}

            {/* Stats Section */}
            <View
              style={[styles.statsSection, { backgroundColor: colors.bubble }]}
            >
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>
                  Reputation
                </Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  {profile.reputation}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>
                  Hive Power
                </Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  {profile.hivePower.toLocaleString()} HP
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.text }]}>
                  HBD
                </Text>
                <Text style={[styles.statValue, { color: colors.payout }]}>
                  ${profile.hbd.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Unclaimed Rewards Section - Only show for own profile with unclaimed rewards */}
            {isOwnProfile &&
              profile.unclaimedHive !== undefined &&
              profile.unclaimedHbd !== undefined &&
              profile.unclaimedVests !== undefined &&
              (profile.unclaimedHive > 0 ||
                profile.unclaimedHbd > 0 ||
                profile.unclaimedVests > 0) && (
                <View
                  style={[
                    styles.unclaimedSection,
                    {
                      backgroundColor: colors.bubble,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.unclaimedTitle, { color: colors.text }]}>
                    Unclaimed Rewards
                  </Text>

                  <View style={styles.unclaimedRewards}>
                    {profile.unclaimedVests > 0 && (
                      <Text
                        style={[styles.unclaimedText, { color: colors.payout }]}
                      >
                        {vestsToHp(
                          profile.unclaimedVests,
                          globalProps?.total_vesting_fund_hive,
                          globalProps?.total_vesting_shares
                        ).toFixed(3)}{' '}
                        HP
                      </Text>
                    )}
                    {profile.unclaimedHbd > 0 && (
                      <Text
                        style={[styles.unclaimedText, { color: colors.payout }]}
                      >
                        {profile.unclaimedHbd.toFixed(3)} HBD
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.claimButton,
                      { backgroundColor: colors.icon },
                    ]}
                    onPress={handleClaimRewards}
                    disabled={claimLoading || processing}
                  >
                    {claimLoading ? (
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color='#fff'
                      />
                    ) : processing ? (
                      <FontAwesome name='refresh' size={16} color='#fff' />
                    ) : (
                      <FontAwesome name='dollar' size={16} color='#fff' />
                    )}
                    <Text style={styles.claimButtonText}>
                      {claimLoading
                        ? 'Claiming...'
                        : processing
                          ? 'Processing...'
                          : 'CLAIM NOW'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {/* Additional Info */}
            {(profile.location || profile.website) && (
              <View style={styles.additionalInfo}>
                {profile.location && (
                  <View style={styles.infoRow}>
                    <FontAwesome
                      name='map-marker'
                      size={16}
                      color={colors.icon}
                    />
                    <Text style={[styles.infoText, { color: colors.text }]}>
                      {profile.location}
                    </Text>
                  </View>
                )}

                {profile.website && (
                  <View style={styles.infoRow}>
                    <FontAwesome name='link' size={16} color={colors.icon} />
                    <Text style={[styles.infoText, { color: colors.icon }]}>
                      {profile.website}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Recent Snaps Section */}
            <View style={styles.snapsSection}>
              <Text style={[styles.snapsSectionTitle, { color: colors.text }]}>
                Recent Snaps
              </Text>

              {!snapsLoaded ? (
                <TouchableOpacity
                  style={[
                    styles.loadSnapsButton,
                    { backgroundColor: colors.button },
                  ]}
                  onPress={fetchUserSnaps}
                  disabled={snapsLoading}
                  activeOpacity={0.8}
                >
                  {snapsLoading ? (
                    <>
                      <FontAwesome
                        name='hourglass-half'
                        size={16}
                        color={colors.buttonText}
                      />
                      <Text
                        style={[
                          styles.loadSnapsButtonText,
                          { color: colors.buttonText },
                        ]}
                      >
                        Loading...
                      </Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome
                        name='comment'
                        size={16}
                        color={colors.buttonText}
                      />
                      <Text
                        style={[
                          styles.loadSnapsButtonText,
                          { color: colors.buttonText },
                        ]}
                      >
                        Show Recent Snaps
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.snapsSectionHeader}>
                    <TouchableOpacity
                      style={styles.refreshButton}
                      onPress={fetchUserSnaps}
                      disabled={snapsLoading}
                    >
                      <FontAwesome
                        name='refresh'
                        size={16}
                        color={colors.icon}
                      />
                    </TouchableOpacity>
                  </View>

                  {snapsError ? (
                    <View style={styles.snapsErrorContainer}>
                      <FontAwesome
                        name='exclamation-triangle'
                        size={24}
                        color='#E74C3C'
                      />
                      <Text
                        style={[styles.snapsErrorText, { color: colors.text }]}
                      >
                        {snapsError}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.retryButton,
                          { backgroundColor: colors.button },
                        ]}
                        onPress={fetchUserSnaps}
                        disabled={snapsLoading}
                      >
                        <Text
                          style={[
                            styles.retryButtonText,
                            { color: colors.buttonText },
                          ]}
                        >
                          Try Again
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : userSnaps.length === 0 ? (
                    <View style={styles.snapsEmptyContainer}>
                      <FontAwesome
                        name='comment-o'
                        size={32}
                        color={colors.buttonInactive}
                      />
                      <Text
                        style={[styles.snapsEmptyText, { color: colors.text }]}
                      >
                        No recent snaps found
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.verticalFeedContainer}>
                      {/* Display snaps using the existing Snap component */}
                      {userSnaps
                        .slice(0, displayedSnapsCount)
                        .map((userSnap, index) => {
                          const snapProps = convertUserSnapToSnapProps(
                            userSnap,
                            currentUsername
                          );

                          return (
                            <Snap
                              key={`${userSnap.author}-${userSnap.permlink}`}
                              snap={snapProps}
                              onUpvotePress={snap =>
                                openUpvoteModal({
                                  author: snap.author,
                                  permlink: snap.permlink,
                                  snap,
                                })
                              }
                              onSpeechBubblePress={() =>
                                handleSnapReply(userSnap)
                              }
                              onContentPress={() => handleSnapPress(userSnap)}
                              showAuthor={true} // Show author for consistency with other feeds
                              onEditPress={handleEditPress}
                              onResnapPress={(author, permlink) => {
                                const snapUrl = `https://hive.blog/@${author}/${permlink}`;
                                router.push({
                                  pathname: '/screens/ComposeScreen',
                                  params: { resnapUrl: snapUrl },
                                });
                              }}
                              currentUsername={currentUsername}
                            />
                          );
                        })}

                      {/* Load More Button */}
                      {displayedSnapsCount < userSnaps.length && (
                        <TouchableOpacity
                          style={[
                            styles.loadMoreButton,
                            { backgroundColor: colors.buttonInactive },
                          ]}
                          onPress={loadMoreSnaps}
                          disabled={loadMoreLoading}
                          activeOpacity={0.8}
                        >
                          {loadMoreLoading ? (
                            <>
                              <FontAwesome
                                name='hourglass-half'
                                size={16}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.loadMoreButtonText,
                                  { color: colors.text },
                                ]}
                              >
                                Loading...
                              </Text>
                            </>
                          ) : (
                            <>
                              <FontAwesome
                                name='chevron-down'
                                size={16}
                                color={colors.text}
                              />
                              <Text
                                style={[
                                  styles.loadMoreButtonText,
                                  { color: colors.text },
                                ]}
                              >
                                Load More (
                                {userSnaps.length - displayedSnapsCount}{' '}
                                remaining)
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Logout Button - Only show for own profile */}
            {isOwnProfile && (
              <View style={styles.logoutSection}>
                <TouchableOpacity
                  style={[styles.logoutButton, { backgroundColor: '#E74C3C' }]}
                  onPress={async () => {
                    await handleLogout();
                    router.replace('/');
                  }}
                >
                  <FontAwesome name='sign-out' size={18} color='#fff' />
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Profile not found
          </Text>
        </View>
      )}

      {/* Edit Avatar Modal */}
      <Modal
        visible={editAvatarModalVisible}
        transparent
        animationType='fade'
        onRequestClose={closeModals}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 24,
              width: '90%',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 16,
              }}
            >
              Update Profile Image
            </Text>

            {/* Current vs New Avatar Preview */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              {/* Current Avatar */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}
                >
                  Current
                </Text>
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: colors.bubble,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <FontAwesome name='user' size={40} color={colors.icon} />
                  </View>
                )}
              </View>

              {/* Arrow */}
              <FontAwesome
                name='arrow-right'
                size={20}
                color={colors.icon}
                style={{ marginHorizontal: 16 }}
              />

              {/* New Avatar */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{ color: colors.text, fontSize: 14, marginBottom: 8 }}
                >
                  New
                </Text>
                {newAvatarImage ? (
                  <Image
                    source={{ uri: newAvatarImage }}
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: colors.buttonInactive,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <FontAwesome name='camera' size={30} color={colors.icon} />
                  </View>
                )}
              </View>
            </View>

            {/* Select Image Button */}
            {!newAvatarImage && (
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.buttonInactive,
                  borderRadius: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  marginBottom: 16,
                }}
                onPress={handleSelectNewAvatar}
                disabled={avatarUploading || avatarUpdateLoading}
              >
                <FontAwesome
                  name='image'
                  size={20}
                  color={colors.icon}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {avatarUploading ? 'Uploading...' : 'Select New Image'}
                </Text>
                {avatarUploading && (
                  <ActivityIndicator
                    size='small'
                    color={colors.icon}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </Pressable>
            )}

            {/* Change Image Button (if image already selected) */}
            {newAvatarImage && !avatarUpdateLoading && !avatarUpdateSuccess && (
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.buttonInactive,
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginBottom: 16,
                }}
                onPress={handleSelectNewAvatar}
                disabled={avatarUploading}
              >
                <FontAwesome
                  name='refresh'
                  size={16}
                  color={colors.icon}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  Change Image
                </Text>
              </Pressable>
            )}

            {/* Action Buttons or Loading/Success States */}
            {avatarUpdateLoading ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <FontAwesome
                  name='hourglass-half'
                  size={32}
                  color={colors.icon}
                />
                <Text style={{ color: colors.text, marginTop: 8 }}>
                  Updating profile...
                </Text>
              </View>
            ) : avatarUpdateSuccess ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <FontAwesome
                  name='check-circle'
                  size={32}
                  color={colors.button}
                />
                <Text style={{ color: colors.text, marginTop: 8 }}>
                  Profile updated!
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Pressable
                  style={{
                    flex: 1,
                    marginRight: 8,
                    backgroundColor: colors.buttonInactive,
                    borderRadius: 8,
                    padding: 12,
                    alignItems: 'center',
                  }}
                  onPress={closeModals}
                  disabled={avatarUpdateLoading || avatarUploading}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    backgroundColor: newAvatarImage
                      ? colors.button
                      : colors.buttonInactive,
                    borderRadius: 8,
                    padding: 12,
                    alignItems: 'center',
                  }}
                  onPress={handleNextStep}
                  disabled={
                    !newAvatarImage || avatarUpdateLoading || avatarUploading
                  }
                >
                  <Text
                    style={{
                      color: newAvatarImage ? colors.buttonText : colors.text,
                      fontWeight: '600',
                    }}
                  >
                    Next
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Active Key Input Modal (Second Step) */}
      <Modal
        visible={activeKeyModalVisible}
        transparent
        animationType='fade'
        onRequestClose={closeModals}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 16,
                padding: 24,
                width: '90%',
                maxWidth: 400,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                Confirm Avatar Update
              </Text>

              {/* Security Notice */}
              <View
                style={{
                  backgroundColor: colors.bubble,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <FontAwesome
                    name='shield'
                    size={20}
                    color={colors.icon}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    Security Notice
                  </Text>
                </View>
                <Text
                  style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}
                >
                  To change your avatar, your active key is needed. This will be
                  used to sign the transaction only. It will not be stored on
                  this phone for security reasons.
                </Text>
              </View>

              {/* Active Key Input */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ color: colors.text, fontSize: 15, marginBottom: 8 }}
                >
                  Enter your active key:
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.buttonInactive,
                    borderRadius: 8,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <TextInput
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      minHeight: 40,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                    placeholder='5K... (your active private key)'
                    placeholderTextColor={colors.buttonInactive}
                    value={activeKeyInput}
                    onChangeText={setActiveKeyInput}
                    secureTextEntry={true}
                    autoCapitalize='none'
                    autoCorrect={false}
                    editable={!avatarUpdateLoading}
                    multiline={true}
                    textAlignVertical='top'
                  />
                </View>
              </View>

              {/* Preview of change */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {/* Current Avatar */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    Current
                  </Text>
                  {profile?.avatarUrl ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      style={{ width: 50, height: 50, borderRadius: 25 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: colors.bubble,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <FontAwesome name='user' size={25} color={colors.icon} />
                    </View>
                  )}
                </View>

                {/* Arrow */}
                <FontAwesome
                  name='arrow-right'
                  size={16}
                  color={colors.icon}
                  style={{ marginHorizontal: 12 }}
                />

                {/* New Avatar */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    New
                  </Text>
                  {newAvatarImage && (
                    <Image
                      source={{ uri: newAvatarImage }}
                      style={{ width: 50, height: 50, borderRadius: 25 }}
                    />
                  )}
                </View>
              </View>

              {/* Action Buttons or Loading/Success States */}
              {avatarUpdateLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <FontAwesome
                    name='hourglass-half'
                    size={32}
                    color={colors.icon}
                  />
                  <Text style={{ color: colors.text, marginTop: 8 }}>
                    Signing transaction...
                  </Text>
                </View>
              ) : avatarUpdateSuccess ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <FontAwesome
                    name='check-circle'
                    size={32}
                    color={colors.button}
                  />
                  <Text style={{ color: colors.text, marginTop: 8 }}>
                    Avatar updated successfully!
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    style={{
                      flex: 1,
                      marginRight: 8,
                      backgroundColor: colors.buttonInactive,
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      closeModals();
                      handleEditAvatarPress(); // Go back to first modal
                    }}
                    disabled={avatarUpdateLoading}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      backgroundColor: activeKeyInput.trim()
                        ? colors.button
                        : colors.buttonInactive,
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                    }}
                    onPress={handleUpdateAvatar}
                    disabled={!activeKeyInput.trim() || avatarUpdateLoading}
                  >
                    <Text
                      style={{
                        color: activeKeyInput.trim()
                          ? colors.buttonText
                          : colors.text,
                        fontWeight: '600',
                      }}
                    >
                      Sign Transaction
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upvote Modal */}
      <UpvoteModal
        visible={upvoteModalVisible}
        voteWeight={voteWeight}
        voteValue={voteValue}
        voteWeightLoading={voteWeightLoading}
        upvoteLoading={upvoteLoading}
        upvoteSuccess={upvoteSuccess}
        onClose={closeUpvoteModal}
        onConfirm={confirmUpvote}
        onVoteWeightChange={setVoteWeight}
        colors={colors}
      />

      {/* Edit Modal removed - now using ComposeScreen */}
    </SafeAreaViewSA>
  );
};

export default ProfileScreen;

export const options = { headerShown: false };
