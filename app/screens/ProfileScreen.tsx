import React, { useCallback } from 'react';
import { SafeAreaView as SafeAreaViewSA } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createProfileScreenStyles } from '../../styles/ProfileScreenStyles';
import { getTheme } from '../../constants/Colors';
import Snap from '../components/Snap';
import UpvoteModal from '../../components/UpvoteModal';
import { ActionButton } from '../components/profile/ActionButton';
import { StatItem } from '../components/profile/StatItem';
import { InfoRow } from '../components/profile/InfoRow';
import { SocialStatItem } from '../components/profile/SocialStatItem';
import { LoadingState } from '../components/profile/LoadingState';
import { EditAvatarModal } from '../components/profile/EditAvatarModal';
import { ActiveKeyModal } from '../components/profile/ActiveKeyModal';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { RewardsSection } from '../components/profile/RewardsSection';
import { ProfileSnaps } from '../components/profile/ProfileSnaps';
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

  // Colors for JSX elements from centralized theme
  const theme = getTheme(isDark ? 'dark' : 'light');
  const colors = {
    background: theme.background,
    text: theme.text,
    bubble: theme.bubble,
    border: theme.border,
    icon: theme.icon,
    payout: theme.payout,
    button: theme.button,
    buttonText: theme.buttonText,
    buttonInactive: theme.buttonInactive,
    mutedButton: theme.mutedButton,
    followButton: theme.followButton,
    unfollowButton: theme.unfollowButton,
  };

  // Handle snap bubble press (navigate to conversation)
  const handleSnapPress = useCallback((snap: any) => {
    router.push({
      pathname: '/screens/ConversationScreen',
      params: {
        author: snap.author,
        permlink: snap.permlink,
      },
    });
  }, [router]);

  // Handle reply to profile snap bubble
  const handleSnapReply = useCallback((snap: any) => {
    router.push({
      pathname: '/screens/ConversationScreen',
      params: {
        author: snap.author,
        permlink: snap.permlink,
      },
    });
  }, [router]);

  // Handle edit press
  const handleEditPress = useCallback((snapData: {
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
  }, [router]);

  // Handle resnap press
  const handleResnapPress = useCallback((author: string, permlink: string) => {
    const snapUrl = `https://hive.blog/@${author}/${permlink}`;
    router.push({
      pathname: '/screens/ComposeScreen',
      params: { resnapUrl: snapUrl },
    });
  }, [router]);

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
            <ProfileHeader
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              isOwnProfile={isOwnProfile}
              colors={colors}
              styles={styles}
              onEditAvatarPress={handleEditAvatarPress}
            />

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

            {/* Unclaimed Rewards Section */}
            <RewardsSection
              isOwnProfile={isOwnProfile}
              profile={profile}
              globalProps={globalProps}
              claimLoading={claimLoading}
              processing={processing}
              colors={colors}
              styles={styles}
              handleClaimRewards={handleClaimRewards}
            />

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
            <ProfileSnaps
              snapsLoaded={snapsLoaded}
              snapsLoading={snapsLoading}
              snapsError={snapsError}
              userSnaps={userSnaps}
              displayedSnapsCount={displayedSnapsCount}
              loadMoreLoading={loadMoreLoading}
              currentUsername={currentUsername}
              colors={colors}
              styles={styles}
              fetchUserSnaps={fetchUserSnaps}
              loadMoreSnaps={loadMoreSnaps}
              convertUserSnapToSnapProps={convertUserSnapToSnapProps}
              openUpvoteModal={openUpvoteModal}
              handleSnapReply={handleSnapReply}
              handleSnapPress={handleSnapPress}
              handleEditPress={handleEditPress}
              onResnapPress={handleResnapPress}
            />

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
