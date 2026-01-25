import React from 'react';
import { SafeAreaView as SafeAreaViewSA } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  Image,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createProfileScreenStyles } from '../../styles/ProfileScreenStyles';
import Snap from '../components/Snap';
import UpvoteModal from '../../components/UpvoteModal';
import { ActionButton } from '../components/profile/ActionButton';
import { StatItem } from '../components/profile/StatItem';
import { InfoRow } from '../components/profile/InfoRow';
import { SocialStatItem } from '../components/profile/SocialStatItem';
import { LoadingState } from '../components/profile/LoadingState';
import { EditAvatarModal } from '../components/profile/EditAvatarModal';
import { ActiveKeyModal } from '../components/profile/ActiveKeyModal';
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
import { vestsToHp } from '../../utils/hiveCalculations';
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
        <LoadingState
          message="Loading profile..."
          iconColor={colors.icon}
          textColor={colors.text}
          iconSize={48}
        />
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
              <SocialStatItem
                count={profile.followersCount || 0}
                label="Followers"
                textColor={colors.text}
              />
              <SocialStatItem
                count={profile.followingCount || 0}
                label="Following"
                textColor={colors.text}
              />
            </View>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {isFollowing ? (
                  <ActionButton
                    icon="user-times"
                    label={followLoading ? 'Unfollowing...' : 'Unfollow'}
                    onPress={handleUnfollow}
                    loading={followLoading}
                    backgroundColor={colors.unfollowButton}
                  />
                ) : (
                  <ActionButton
                    icon="user-plus"
                    label={followLoading ? 'Following...' : 'Follow'}
                    onPress={handleFollow}
                    loading={followLoading}
                    backgroundColor={colors.followButton}
                  />
                )}

                {isMuted ? (
                  <ActionButton
                    icon="volume-up"
                    label={muteLoading ? 'Unblocking...' : 'Unblock'}
                    onPress={handleUnmute}
                    loading={muteLoading}
                    backgroundColor={colors.buttonInactive}
                    textColor={colors.text}
                  />
                ) : (
                  <ActionButton
                    icon="volume-off"
                    label={muteLoading ? 'Blocking...' : 'Block'}
                    onPress={handleMute}
                    loading={muteLoading}
                    backgroundColor={colors.mutedButton}
                  />
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
              <StatItem
                label="Reputation"
                value={profile.reputation}
                textColor={colors.text}
                valueColor={colors.payout}
              />
              <StatItem
                label="Hive Power"
                value={`${profile.hivePower.toLocaleString()} HP`}
                textColor={colors.text}
                valueColor={colors.payout}
              />
              <StatItem
                label="HBD"
                value={`$${profile.hbd.toFixed(2)}`}
                textColor={colors.text}
                valueColor={colors.payout}
              />
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
                  <InfoRow
                    icon="map-marker"
                    text={profile.location}
                    iconColor={colors.icon}
                    textColor={colors.text}
                  />
                )}
                {profile.website && (
                  <InfoRow
                    icon="link"
                    text={profile.website}
                    iconColor={colors.icon}
                    textColor={colors.icon}
                  />
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
      <EditAvatarModal
        visible={editAvatarModalVisible}
        currentAvatarUrl={profile?.avatarUrl}
        newAvatarImage={newAvatarImage}
        avatarUploading={avatarUploading}
        avatarUpdateLoading={avatarUpdateLoading}
        avatarUpdateSuccess={avatarUpdateSuccess}
        colors={colors}
        onClose={closeModals}
        onSelectNewAvatar={handleSelectNewAvatar}
        onNextStep={handleNextStep}
      />

      {/* Active Key Input Modal (Second Step) */}
      <ActiveKeyModal
        visible={activeKeyModalVisible}
        currentAvatarUrl={profile?.avatarUrl}
        newAvatarImage={newAvatarImage}
        activeKeyInput={activeKeyInput}
        avatarUpdateLoading={avatarUpdateLoading}
        avatarUpdateSuccess={avatarUpdateSuccess}
        colors={colors}
        onClose={closeModals}
        onBack={() => {
          closeModals();
          handleEditAvatarPress();
        }}
        onUpdateAvatar={handleUpdateAvatar}
        onActiveKeyChange={setActiveKeyInput}
      />

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
