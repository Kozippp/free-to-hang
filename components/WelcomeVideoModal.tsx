import React, { useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = (SCREEN_WIDTH - 32) * (16 / 9);

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function WelcomeVideoModal({ visible, onClose }: Props) {
  const videoRef = useRef<Video>(null);

  const handleClose = useCallback(async () => {
    try {
      await videoRef.current?.pauseAsync();
    } catch {
      // ignore
    }
    onClose();
  }, [onClose]);

  const handleModalShow = useCallback(async () => {
    try {
      await videoRef.current?.playAsync();
    } catch {
      // ignore
    }
  }, []);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      // Video ended — keep modal open so user can still close manually
    }
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      transparent={Platform.OS !== 'ios'}
      onShow={handleModalShow}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={12}
              accessibilityLabel="Close welcome video"
            >
              <X size={22} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>Welcome to Free to Hang!</Text>
          </View>
          <Text style={styles.subtitle}>
            A quick message from the founder
          </Text>

          {/* Video */}
          <View style={styles.videoWrapper}>
            <Video
              ref={videoRef}
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('@/assets/F2H Tervitusvideo.mov')}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleClose}>
            <Text style={styles.ctaText}>Let's get started!</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
    position: 'relative',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  emoji: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  videoWrapper: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    height: Math.min(VIDEO_HEIGHT, 280),
  },
  video: {
    width: '100%',
    height: '100%',
  },
  ctaButton: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
