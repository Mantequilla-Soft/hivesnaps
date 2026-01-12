/**
 * Audio Recorder Modal
 * Records audio from microphone for audio snaps
 * Refactored to use useAudioRecorder hook and AudioButton component
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import AudioButton from './AudioButton';
import { audioRecorderModalStyles as styles } from './AudioRecorderModal.styles';
import { useAppColors } from '../styles/colors';

interface AudioRecorderModalProps {
    isVisible: boolean;
    onClose: () => void;
    onAudioRecorded: (audioBlob: Blob, durationSeconds: number) => void;
}

const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
    isVisible,
    onClose,
    onAudioRecorded,
}) => {
    const colors = useAppColors();
    const recorder = useAudioRecorder();

    const handleUse = async () => {
        if (!recorder.audioBlob) return;
        recorder.setIsUploading(true);
        try {
            onAudioRecorded(recorder.audioBlob, recorder.duration);
            handleClose();
        } catch (error) {
            console.error('[AudioRecorderModal] Error using audio:', error);
        } finally {
            recorder.setIsUploading(false);
        }
    };

    const handleClose = async () => {
        if (recorder.isRecording) {
            await recorder.stopRecording();
        }
        recorder.reset();
        onClose();
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <SafeAreaView
                style={[styles.container, { backgroundColor: colors.background }]}
                edges={['top', 'bottom']}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Record Audio Snap
                    </Text>
                    <TouchableOpacity
                        onPress={handleClose}
                        disabled={recorder.isUploading}
                        style={styles.closeButton}
                    >
                        <FontAwesome name="times" size={24} color={colors.placeholderText} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Timer Display */}
                    <View style={styles.timerSection}>
                        <Text style={[styles.timerText, { color: colors.text }]}>
                            {recorder.formatTime(recorder.duration)}
                        </Text>
                        <Text style={[styles.maxDurationText, { color: colors.placeholderText }]}>
                            Max: {recorder.formatTime(recorder.maxDuration)}
                        </Text>

                        {/* Progress Bar */}
                        <View
                            style={[
                                styles.progressBar,
                                { backgroundColor: colors.border },
                            ]}
                        >
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${(recorder.duration / recorder.maxDuration) * 100}%`,
                                        backgroundColor:
                                            recorder.duration >= recorder.maxDuration
                                                ? '#ff4444'
                                                : colors.icon,
                                    },
                                ]}
                            />
                        </View>
                    </View>

                    {/* Controls */}
                    <View style={styles.controls}>
                        {!recorder.audioBlob && !recorder.isRecording && (
                            <AudioButton
                                onPress={recorder.startRecording}
                                text="Start Recording"
                                icon="microphone"
                                iconSize={28}
                                variant="danger"
                                style={styles.fullWidthButton}
                            />
                        )}

                        {recorder.isRecording && (
                            <AudioButton
                                onPress={recorder.stopRecording}
                                text="Stop Recording"
                                icon="stop"
                                iconSize={28}
                                variant="danger"
                                style={styles.fullWidthButton}
                            />
                        )}

                        {recorder.audioBlob && (
                            <View style={styles.playbackControls}>
                                <AudioButton
                                    onPress={recorder.togglePlayback}
                                    text={recorder.isPlaying ? 'Pause' : 'Play'}
                                    icon={recorder.isPlaying ? 'pause' : 'play'}
                                    variant="primary"
                                    disabled={recorder.isUploading}
                                    style={styles.playbackButton}
                                />

                                <AudioButton
                                    onPress={recorder.deleteRecording}
                                    text="Delete"
                                    icon="trash"
                                    variant="secondary"
                                    disabled={recorder.isUploading}
                                    style={styles.playbackButton}
                                />
                            </View>
                        )}
                    </View>

                    {/* Status */}
                    {recorder.isRecording && (
                        <View style={styles.statusBadge}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.statusText}>Recording...</Text>
                        </View>
                    )}

                    {recorder.audioBlob && !recorder.isRecording && (
                        <View style={styles.statusBadge}>
                            <FontAwesome name="check-circle" size={14} color="#4CAF50" />
                            <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                                Recording Complete
                            </Text>
                        </View>
                    )}
                </View>

                {/* Footer Buttons */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <AudioButton
                        onPress={handleClose}
                        text="Cancel"
                        variant="ghost"
                        disabled={recorder.isUploading}
                        style={[styles.footerButton, styles.footerButtonLeft]}
                        textStyle={{ color: colors.placeholderText }}
                    />

                    <AudioButton
                        onPress={handleUse}
                        text="Use Audio"
                        variant="primary"
                        disabled={!recorder.audioBlob}
                        isLoading={recorder.isUploading}
                        style={[styles.footerButton, styles.footerButtonRight]}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

export default AudioRecorderModal;
