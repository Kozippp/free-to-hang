import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Share,
  Platform,
  TextInput
} from 'react-native';
import { X, Copy, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface InviteShareModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function InviteShareModal({
  visible,
  onClose
}: InviteShareModalProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  
  const inviteLink = 'https://freetohang.app/invite?ref=alextaylor';
  
  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // Reset states when modal opens
      setCopied(false);
      setShared(false);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);
  
  const handleCopyLink = () => {
    // In a real app, you would use Clipboard.setString(inviteLink)
    // For this demo, we'll just simulate it
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web doesn't support Share API in all browsers
        // Just copy to clipboard instead
        handleCopyLink();
        return;
      }
      
      const result = await Share.share({
        message: `Hey! I'm free to hang out. Click this link to join me: ${inviteLink}`,
        url: inviteLink, // iOS only
        title: 'Free to Hang Invitation', // Android only
      });
      
      if (result.action === Share.sharedAction) {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.modalContainer,
                { opacity: fadeAnim }
              ]}
            >
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={Colors.light.secondaryText} />
              </TouchableOpacity>
              
              <Text style={styles.title}>Invite Friends</Text>
              
              <View style={styles.linkContainer}>
                <TextInput
                  style={styles.linkInput}
                  value={inviteLink}
                  editable={false}
                  selectTextOnFocus
                />
                <TouchableOpacity 
                  style={styles.copyButton}
                  onPress={handleCopyLink}
                >
                  <Copy size={20} color={Colors.light.primary} />
                </TouchableOpacity>
              </View>
              
              {copied && (
                <Text style={styles.copiedText}>Link copied to clipboard!</Text>
              )}
              
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={handleShare}
              >
                <Share2 size={20} color="white" style={styles.shareIcon} />
                <Text style={styles.shareButtonText}>
                  {shared ? 'Invite Sent!' : 'Share Invite Link'}
                </Text>
              </TouchableOpacity>
              
              {shared && (
                <Text style={styles.confirmationText}>
                  Your friend will appear here once they join.
                </Text>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.light.modalBackground,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 20,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    backgroundColor: Colors.light.buttonBackground,
    color: Colors.light.text,
  },
  copyButton: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 10,
  },
  copiedText: {
    fontSize: 14,
    color: Colors.light.primary,
    marginBottom: 16,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  shareIcon: {
    marginRight: 8,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationText: {
    fontSize: 14,
    color: Colors.light.primary,
    textAlign: 'center',
    marginTop: 16,
  },
});