import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions
} from 'react-native';
import { CheckCircle, X, UserPlus, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanCreatedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  planTitle: string;
  isAnonymous?: boolean;
  onInviteFriends?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function PlanCreatedSuccessModal({
  visible,
  onClose,
  planTitle,
  isAnonymous = false,
  onInviteFriends
}: PlanCreatedSuccessModalProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const [bounceAnim] = useState(new Animated.Value(0));
  const [confettiAnims] = useState(
    Array(20).fill(null).map(() => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(1),
    }))
  );

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      bounceAnim.setValue(0);
      confettiAnims.forEach(anim => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.scale.setValue(1);
      });

      // Start success animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 180,
          velocity: 8,
        })
      ]).start(() => {
        // Bounce the modal slightly
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -10,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 8,
            stiffness: 200,
          })
        ]).start();
      });

      // Start confetti animation after a short delay
      setTimeout(() => {
        startConfettiAnimation();
      }, 200);

      // Don't auto-close - let user interact with invite button
    }
  }, [visible]);

  const startConfettiAnimation = () => {
    confettiAnims.forEach((anim, index) => {
      // Random starting positions from the top
      const startX = Math.random() * width;
      const endX = startX + (Math.random() - 0.5) * 200;
      const endY = height + 100;

      anim.translateX.setValue(startX);
      anim.translateY.setValue(-50);

      Animated.parallel([
        Animated.timing(anim.translateY, {
          toValue: endY,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateX, {
          toValue: endX,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim.rotate, {
          toValue: Math.random() * 360,
          duration: 1000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim.scale, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  const handleInviteFriends = () => {
    handleClose();
    if (onInviteFriends) {
      setTimeout(() => {
        onInviteFriends();
      }, 300);
    }
  };

  const getConfettiColors = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#FF9999', '#87CEEB', '#90EE90',
      '#FFB6C1', '#F0E68C', '#E6E6FA'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          {/* Confetti */}
          {confettiAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  backgroundColor: getConfettiColors(),
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    { rotate: anim.rotate.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg']
                    })},
                    { scale: anim.scale }
                  ]
                }
              ]}
            />
          ))}

          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.modalContainer,
                { 
                  opacity: fadeAnim,
                  transform: [
                    { scale: scaleAnim },
                    { translateY: bounceAnim }
                  ]
                }
              ]}
            >
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              {/* Success Icon with Sparkles */}
              <View style={styles.successIconContainer}>
                <Sparkles size={24} color="#FFD700" style={styles.sparkleLeft} />
                <View style={styles.successIcon}>
                  <CheckCircle size={48} color="#4CAF50" />
                </View>
                <Sparkles size={24} color="#FFD700" style={styles.sparkleRight} />
              </View>
              
              <Text style={styles.successTitle}>
                Your plan is live! 🎉
              </Text>
              
              <Text style={styles.successText}>
                {isAnonymous 
                  ? "Your secret plan is out there! Want to invite friends outside the app to join the mystery?"
                  : `"${planTitle}" is ready for action! Want to invite friends outside the app to join?`
                }
              </Text>
              
              {/* Invite Button */}
              <TouchableOpacity 
                style={styles.inviteButton}
                onPress={handleInviteFriends}
              >
                <UserPlus size={20} color="white" style={styles.inviteIcon} />
                <Text style={styles.inviteButtonText}>Invite with Link</Text>
              </TouchableOpacity>
              
              {/* Skip Link */}
              <TouchableOpacity onPress={handleClose} style={styles.skipButton}>
                <Text style={styles.skipText}>Maybe later</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 350,
    backgroundColor: Colors.light.modalBackground,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
  },
  successIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.light.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  sparkleLeft: {
    transform: [{ rotate: '-15deg' }],
  },
  sparkleRight: {
    transform: [{ rotate: '15deg' }],
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inviteIcon: {
    marginRight: 8,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontWeight: '500',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
}); 