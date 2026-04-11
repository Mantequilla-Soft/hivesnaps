import { StyleSheet } from 'react-native';
import { getTheme, palette } from '../constants/Colors';

export const createWalletScreenStyles = (isDark: boolean) => {
    const theme = getTheme(isDark ? 'dark' : 'light');

    return StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.background,
        },
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        backButton: {
            padding: 8,
            marginRight: 8,
        },
        headerTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: theme.text,
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            padding: 16,
            paddingBottom: 40,
        },
        // Balance card
        balanceCard: {
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            backgroundColor: theme.bubble,
        },
        balanceCardTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        balanceRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        balanceItem: {
            alignItems: 'center',
            flex: 1,
        },
        balanceValue: {
            fontSize: 20,
            fontWeight: 'bold',
            color: theme.text,
        },
        balanceLabel: {
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 4,
        },
        balanceDivider: {
            width: 1,
            backgroundColor: theme.border,
            marginHorizontal: 8,
        },
        // Action grid
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        actionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
        },
        actionCard: {
            width: '47.5%',
            borderRadius: 12,
            padding: 16,
            backgroundColor: theme.bubble,
            alignItems: 'center',
            gap: 10,
        },
        actionIconWrap: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
        },
        actionLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.text,
            textAlign: 'center',
        },
        actionSubLabel: {
            fontSize: 11,
            color: theme.textSecondary,
            textAlign: 'center',
            marginTop: -4,
        },
        // Power down status
        powerDownCard: {
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            backgroundColor: theme.warningBoxBackground,
        },
        powerDownCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
        },
        powerDownCardTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.text,
        },
        powerDownCardText: {
            fontSize: 13,
            color: theme.textSecondary,
            lineHeight: 18,
        },
        // Loading / error
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40,
        },
        loadingText: {
            fontSize: 14,
            color: theme.textSecondary,
            marginTop: 12,
        },
        // Inline key input inside modals
        keyInputSection: {
            marginTop: 16,
        },
        keyInputLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.text,
            marginBottom: 6,
        },
        keyInputContainer: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderColor: theme.inputBorder,
            backgroundColor: theme.background,
        },
        keyInput: {
            fontSize: 14,
            minHeight: 40,
            color: theme.text,
        },
        biometricNotice: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: theme.infoBoxBackground,
        },
        biometricNoticeText: {
            fontSize: 13,
            color: theme.textSecondary,
            flex: 1,
        },
    });
};

export { palette };
