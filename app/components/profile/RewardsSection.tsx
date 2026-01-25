import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { vestsToHp } from '../../../utils/hiveCalculations';

interface ColorScheme {
    text: string;
    bubble: string;
    border: string;
    payout: string;
    icon: string;
}

interface RewardsSectionProps {
    isOwnProfile: boolean;
    profile: {
        unclaimedHive?: number;
        unclaimedHbd?: number;
        unclaimedVests?: number;
    };
    globalProps: {
        total_vesting_fund_hive?: string;
        total_vesting_shares?: string;
    } | null;
    claimLoading: boolean;
    processing: boolean;
    colors: ColorScheme;
    /** Styles object created by createProfileScreenStyles - typed as any due to dynamic creation */
    styles: any;
    handleClaimRewards: () => void;
}

export const RewardsSection: React.FC<RewardsSectionProps> = ({
    isOwnProfile,
    profile,
    globalProps,
    claimLoading,
    processing,
    colors,
    styles,
    handleClaimRewards,
}) => {
    // Only show for own profile with unclaimed rewards
    if (
        !isOwnProfile ||
        profile.unclaimedHive === undefined ||
        profile.unclaimedHbd === undefined ||
        profile.unclaimedVests === undefined ||
        (profile.unclaimedHive === 0 &&
            profile.unclaimedHbd === 0 &&
            profile.unclaimedVests === 0)
    ) {
        return null;
    }

    return (
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
                    <Text style={[styles.unclaimedText, { color: colors.payout }]}>
                        {vestsToHp(
                            profile.unclaimedVests,
                            globalProps?.total_vesting_fund_hive,
                            globalProps?.total_vesting_shares
                        ).toFixed(3)}{' '}
                        HP
                    </Text>
                )}
                {profile.unclaimedHbd > 0 && (
                    <Text style={[styles.unclaimedText, { color: colors.payout }]}>
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
                    <FontAwesome name='hourglass-half' size={16} color='#fff' />
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
    );
};
