import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Portrait video (9:16) — takes up most of the screen width
const VIDEO_WIDTH = SCREEN_WIDTH - 48;
const VIDEO_HEIGHT = Math.min(VIDEO_WIDTH * (16 / 9), SCREEN_HEIGHT * 0.52);

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function WelcomeVideoModal({ visible, onClose }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useVideoPlayer(require('@/assets/F2H Tervitusvideo.mov'), (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (visible) {
      player.replay();
    } else {
      player.pause();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    player.pause();
    onClose();
  }, [onClose, player]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={12}
            accessibilityLabel="Close welcome video"
          >
            <X size={20} color={Colors.light.secondaryText} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>Welcome to Free to Hang! 🎉</Text>
          <Text style={styles.subtitle}>A quick message from the founder</Text>

          {/* Video */}
          <View style={styles.videoWrapper}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="cover"
              nativeControls
            />
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleClose}>
            <Text style={styles.ctaText}>Let's get started!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 32,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  videoWrapper: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  ctaButton: {
    marginTop: 16,
    width: '100%',
    backgroundColor: Colors.light.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
