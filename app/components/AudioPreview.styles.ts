/**
 * AudioPreview Component Styles
 * Separated styles for better maintainability
 */

import { StyleSheet } from 'react-native';

export const audioPreviewStyles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        marginHorizontal: 16,
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerText: {
        fontSize: 14,
        fontWeight: '600',
    },
    removeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    audioCard: {
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    audioCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    musicIcon: {
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    readyText: {
        fontSize: 14,
        fontWeight: '500',
    },
    durationText: {
        fontSize: 12,
        opacity: 0.7,
        marginTop: 2,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    removeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    removeButtonText: {
        fontSize: 12,
        fontWeight: '500',
    },
    infoText: {
        fontSize: 11,
        opacity: 0.6,
        marginTop: 8,
    },
});
