import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Link } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
interface InviteFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (friendIds: string[]) => void;
  onCreateInvitationPoll: (friendIds: string[], friendNames: string[]) => void;
  plan: any;
}

export default function InviteFriendsModal({
  visible,
  onClose,
  onInvite,
  onCreateInvitationPoll,
  plan
}: InviteFriendsModalProps) {
  const { user } = useAuth();

  const handleInvite = () => {
    // Create invitation poll without selecting specific friends
    onCreateInvitationPoll([], []);
  };

  const handleClose = () => {
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Friends</Text>
          </View>
          
          
          
          {/* Invite by link section */}
          <View style={styles.inviteLinkSection}>
            <TouchableOpacity 
              style={styles.inviteLinkButton}
              onPress={() => {
                Alert.alert(
                  'Invite by Link',
                  'This feature will be available soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Link size={16} color={Colors.light.primary} />
              <Text style={styles.inviteLinkButtonText}>Invite friends outside the app</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleInvite}
            >
              <Text style={styles.inviteButtonText}>
                Create Invitation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.secondaryText,
  },
  inviteButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  inviteLinkSection: {
    padding: 16,
  },
  inviteLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
  },
  inviteLinkButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 8,
  },
});