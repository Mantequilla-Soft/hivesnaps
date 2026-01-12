/**
 * AudioRecorderModal Component Styles
 * Separated styles for better maintainability
 */

import { StyleSheet } from 'react-native';

export const audioRecorderModalStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    timerSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    timerText: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    maxDurationText: {
        fontSize: 14,
        marginBottom: 12,
    },
    progressBar: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    controls: {
        alignItems: 'center',
        marginBottom: 30,
    },
    fullWidthButton: {
        width: '80%',
        marginBottom: 12,
    },
    playbackControls: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
    },
    playbackButton: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'center',
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ff4444',
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ff4444',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    footerButton: {
        flex: 1,
    },
    footerButtonLeft: {
        marginRight: 8,
    },
    footerButtonRight: {
        marginLeft: 8,
    },
});
