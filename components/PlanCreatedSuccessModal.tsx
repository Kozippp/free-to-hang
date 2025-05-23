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
import { CheckCircle, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PlanCreatedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  planTitle: string;
  isAnonymous?: boolean;
}

const { width, height } = Dimensions.get('window');

export default function PlanCreatedSuccessModal({
  visible,
  onClose,
  planTitle,
  isAnonymous = false
}: PlanCreatedSuccessModalProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
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
          damping: 15,
          stiffness: 150,
        })
      ]).start();

      // Start confetti animation after a short delay
      setTimeout(() => {
        startConfettiAnimation();
      }, 200);

      // Auto close after 4 seconds (longer to enjoy the celebration)
      setTimeout(() => {
        handleClose();
      }, 4000);
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
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              <View style={styles.successIcon}>
                <CheckCircle size={64} color="#4CAF50" />
              </View>
              
              <Text style={styles.successTitle}>
                🎉 Plan Created Successfully! 🎉
              </Text>
              
              <Text style={styles.planTitle}>
                "{planTitle}"
              </Text>
              
              <Text style={styles.successText}>
                {isAnonymous 
                  ? "Your secret plan is brewing! 🤫\nCheck the Invitations tab to see who's curious enough to join the mystery."
                  : "Your awesome plan is ready! 🚀\nTime to see who's up for some fun!"
                }
              </Text>
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
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4CAF50',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(76, 175, 80, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    backgroundColor: `${Colors.light.primary}10`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  successText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
}); 