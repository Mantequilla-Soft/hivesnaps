import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { FontAwesome } from '@expo/vector-icons';
import { decodeHiveTransferQR, HiveTransferQRData } from '../../../utils/hiveQr';

interface ScanPaymentModalProps {
    visible: boolean;
    colors: {
        button: string;
        buttonText: string;
    };
    onClose: () => void;
    onScanned: (data: HiveTransferQRData) => void;
}

export const ScanPaymentModal: React.FC<ScanPaymentModalProps> = ({
    visible,
    colors,
    onClose,
    onScanned,
}) => {
    const [permission, requestPermission] = useCameraPermissions();
    // Guards against onBarcodeScanned firing repeatedly for the same code
    // while the scanner stays open for the instant between decode and modal close.
    const hasHandledRef = useRef(false);

    useEffect(() => {
        if (visible) hasHandledRef.current = false;
    }, [visible]);

    const handleBarcodeScanned = (result: BarcodeScanningResult): void => {
        if (hasHandledRef.current) return;
        const decoded = decodeHiveTransferQR(result.data);
        if (!decoded) return; // not a Hive transfer QR — keep scanning
        hasHandledRef.current = true;
        onScanned(decoded);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {!permission ? (
                    <View style={styles.center}>
                        <ActivityIndicator color="#fff" />
                    </View>
                ) : !permission.granted ? (
                    <View style={styles.center}>
                        <FontAwesome name="camera" size={40} color="#fff" style={{ marginBottom: 16 }} />
                        <Text style={styles.permissionText}>
                            Camera access is needed to scan a payment QR code.
                        </Text>
                        <Pressable
                            style={[styles.permissionButton, { backgroundColor: colors.button }]}
                            onPress={requestPermission}
                        >
                            <Text style={[styles.permissionButtonText, { color: colors.buttonText }]}>
                                Grant Access
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={handleBarcodeScanned}
                    />
                )}

                {permission?.granted ? (
                    <View style={styles.hintBanner} pointerEvents="none">
                        <Text style={styles.hintText}>Point your camera at a payment QR code</Text>
                    </View>
                ) : null}

                <Pressable
                    style={styles.closeButton}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close scanner"
                >
                    <FontAwesome name="close" size={22} color="#fff" />
                </Pressable>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    permissionText: {
        color: '#fff',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    hintBanner: {
        position: 'absolute',
        bottom: 48,
        left: 24,
        right: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    hintText: {
        color: '#fff',
        fontSize: 13,
        textAlign: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 48,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
});
