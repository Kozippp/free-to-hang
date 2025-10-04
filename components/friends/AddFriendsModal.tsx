import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Share,
  Linking
} from 'react-native';
import { X, Search, UserPlus, Share2, Users, ChevronRight, RotateCcw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import * as Contacts from 'expo-contacts';
import useFriendsStore from '@/store/friendsStore';
import UserProfileModal from '@/components/UserProfileModal';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  vibe?: string;
  relationshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted_sent' | 'accepted_received' | 'declined_sent' | 'declined_received' | 'friends' | 'blocked_by_me' | 'blocked_by_them';
}

interface AddFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddFriendsModal({ visible, onClose }: AddFriendsModalProps) {
  // Use friendsStore for search and send requests
  const { 
    searchResults,
    outgoingRequests,
    incomingRequests,
    isSearching,
    searchUsers,
    sendFriendRequest,
    cancelFriendRequest,
    loadOutgoingRequests,
    loadIncomingRequests
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [hasContactsPermission, setHasContactsPermission] = useState(false);
  const [currentUserUsername, setCurrentUserUsername] = useState<string>('');
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactFriends, setContactFriends] = useState<User[]>([]);
  const [showContactsList, setShowContactsList] = useState(false);
  const [contactsAccessGranted, setContactsAccessGranted] = useState(false);
  const [cancelledRequestIds, setCancelledRequestIds] = useState<Set<string>>(new Set());

  // Load current user username
  useEffect(() => {
    loadCurrentUserUsername();
  }, []);

  const loadCurrentUserUsername = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();

      if (userData?.username) {
        setCurrentUserUsername(userData.username);
      }
    } catch (error) {
      console.error('Error loading username:', error);
    }
  };

  const requestContactsPermission = async () => {
    // TODO: Implement contacts permission with expo-contacts
    Alert.alert(
      'Contacts Access',
      'This feature will be available soon.',
      [{ text: 'OK' }]
    );
    setShowContactsModal(false);
  };

  // Search with debounce - use friendsStore
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSelectedUser(null);
      setShowUserProfile(false);
      setShowContactsModal(false);
      setCancelledRequestIds(new Set());
    }
  }, [visible]);

  // Load outgoing requests when modal opens
  useEffect(() => {
    if (visible) {
      loadOutgoingRequests();
      loadIncomingRequests();
    }
  }, [visible]);

  const handleUserPress = (user: User) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleAddFriend = async (user: User) => {
    try {
      console.log('📤 Sending friend request to:', user.name);
      await sendFriendRequest(user.id);
      console.log('✅ Friend request sent successfully');
      
      // The sendFriendRequest already bypasses cache and updates the store
      // No need to reload here as it's already done in the store
      
      // Refresh search results to update relationship status if we have an active search
      if (searchQuery.trim().length >= 2) {
        console.log('🔄 Refreshing search results after friend request');
        await searchUsers(searchQuery);
      }
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const handleUndoFriendRequest = async (user: User) => {
    try {
      console.log('🔄 Cancelling friend request to:', user.name);
      await cancelFriendRequest(user.id);
      console.log('✅ Friend request cancelled successfully');
      
      // The cancelFriendRequest already bypasses cache and updates the store
      // No need to reload here as it's already done in the store
      
      // Refresh search results to update relationship status if we have an active search
      if (searchQuery.trim().length >= 2) {
        console.log('🔄 Refreshing search results after cancelling friend request');
        await searchUsers(searchQuery);
      }
    } catch (error) {
      console.error('❌ Error cancelling friend request:', error);
      Alert.alert('Error', 'Failed to cancel friend request. Please try again.');
    }
  };

  // Check if user has a pending request (sent OR received)
  const userHasPendingRequest = (userId: string) => {
    return outgoingRequests.some(req => req.receiver_id === userId);
  };

  const userHasIncomingRequest = (userId: string) => {
    return incomingRequests.some(req => req.sender_id === userId);
  };

  const handleInviteFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user data for username
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();

      const shareUrl = `https://freetohang.app/invite/${userData?.username || user.id}`;
      
      await Share.share({
        message: `Join me on Free to Hang! ${shareUrl}`,
        url: shareUrl,
        title: 'Join Free to Hang'
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleRequestContactsAccess = async () => {
    setLoadingContacts(true);
    setContactsModalVisible(false);
    
    try {
      console.log('Requesting contacts permission...');
      
      // First request permission
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Contacts permission denied');
        Alert.alert(
          'Permission Denied',
          'We need access to your contacts to find friends who are already on Free to Hang. You can enable this later in your device settings.',
          [{ text: 'OK' }]
        );
        setLoadingContacts(false);
        return;
      }

      console.log('Contacts permission granted, loading contacts...');
      
      // Get contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Name],
      });

      console.log('Loaded contacts from device:', data.length);

      if (data.length > 0) {
        // Extract emails and names from contacts
        const contactEmails: string[] = [];
        const contactNames: string[] = [];
        
        data.forEach((contact: any) => {
          // Extract emails
          if (contact.emails) {
            contact.emails.forEach((email: any) => {
              if (email.email) {
                contactEmails.push(email.email.toLowerCase().trim());
              }
            });
          }
          
          // Extract names (first name, last name, middle name)
          if (contact.name) {
            if (contact.firstName) contactNames.push(contact.firstName.toLowerCase().trim());
            if (contact.lastName) contactNames.push(contact.lastName.toLowerCase().trim());
            if (contact.middleName) contactNames.push(contact.middleName.toLowerCase().trim());
            if (contact.name) contactNames.push(contact.name.toLowerCase().trim());
          }
        });

        console.log('Extracted emails from contacts:', contactEmails.length);
        console.log('Extracted names from contacts:', contactNames.length);

        // Find users in our database that match these contacts
        if (contactEmails.length > 0 || contactNames.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          let matchingUsers: any[] = [];

          // Search by emails first
          if (contactEmails.length > 0) {
            const emailFilter = contactEmails.map(email => `email.eq.${email}`).join(',');

            const { data: emailMatches, error: emailError } = await supabase
              .from('users')
              .select('id, name, username, avatar_url, vibe, email')
              .or(emailFilter)
              .neq('id', user.id)
              .eq('onboarding_completed', true);

            if (!emailError && emailMatches) {
              matchingUsers = [...matchingUsers, ...emailMatches];
            }
          }

          // Search by names (first name or last name)
          if (contactNames.length > 0) {
            // Create name search patterns
            const nameQueries = contactNames.map(name => 
              `name.ilike.%${name}%`
            ).join(',');

            const { data: nameMatches, error: nameError } = await supabase
              .from('users')
              .select('id, name, username, avatar_url, vibe, email')
              .or(nameQueries)
              .neq('id', user.id)
              .eq('onboarding_completed', true);

            if (!nameError && nameMatches) {
              // Merge with email matches and remove duplicates
              nameMatches.forEach((nameMatch: any) => {
                if (!matchingUsers.find(user => user.id === nameMatch.id)) {
                  matchingUsers.push(nameMatch);
                }
              });
            }
          }

          console.log('Found matching users from contacts:', matchingUsers.length);
          
          // Use friendsStore to check relationship status instead of direct DB queries
          const { friends, outgoingRequests } = useFriendsStore.getState();
          
          const friendIds = friends.map(u => u.friend_id);
          const pendingIds = outgoingRequests.map(u => u.receiver_id);

          const availableUsers = matchingUsers.filter((user: any) => 
            !friendIds.includes(user.id)
          );
          
          // Mark users with pending requests
          const usersWithStatus = availableUsers.map((user: any) => ({
            ...user,
            friendRequestSent: pendingIds.includes(user.id)
          }));

          setContactFriends(usersWithStatus);
          setContactsAccessGranted(true);
          setShowContactsList(true);
          
          console.log('Final contact friends list:', usersWithStatus.length);
        } else {
          console.log('No email addresses or names found in contacts');
          setContactFriends([]);
          setContactsAccessGranted(true);
          setShowContactsList(true);
        }
      } else {
        console.log('No contacts found on device');
        setContactFriends([]);
        setContactsAccessGranted(true);
        setShowContactsList(true);
      }
    } catch (error) {
      console.error('Error accessing contacts:', error);
      Alert.alert('Error', 'Failed to access contacts. Please try again.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleResetContacts = () => {
    setContactsAccessGranted(false);
    setShowContactsList(false);
    setContactFriends([]);
  };

  const renderSearchResult = ({ item }: { item: User }) => {
    // Use the relationship status from the search results (which now includes status)
    const relationshipStatus = item.relationshipStatus || 'none';
    
    // Determine button state and action based on relationship status
    let buttonText = '';
    let buttonAction = () => {};
    let buttonStyle = styles.quickAddButton;
    let buttonContent = null;
    
    switch (relationshipStatus) {
      case 'pending_sent':
        buttonText = 'Pending';
        buttonAction = () => handleUndoFriendRequest(item);
        buttonStyle = [styles.quickAddButton, styles.pendingButton] as any;
        buttonContent = <Text style={styles.pendingText}>Pending</Text>;
        break;
        
      case 'pending_received':
        buttonText = 'Accept';
        buttonAction = () => console.log('🚫 Accept friend request disabled (frontend only)');
        buttonStyle = [styles.quickAddButton, styles.acceptButton] as any;
        buttonContent = <Text style={styles.acceptText}>Accept</Text>;
        break;
        
      case 'accepted_sent':
      case 'accepted_received':
      case 'friends':
        buttonText = 'Friends';
        buttonAction = () => {}; // No action for existing friends
        buttonStyle = [styles.quickAddButton, styles.friendsButton] as any;
        buttonContent = <Text style={styles.friendsText}>Friends</Text>;
        break;
        
      case 'blocked_by_me':
        buttonText = 'Blocked';
        buttonAction = () => {}; // Handle unblocking in profile modal
        buttonStyle = [styles.quickAddButton, styles.blockedButton] as any;
        buttonContent = <Text style={styles.blockedText}>Blocked</Text>;
        break;
        
      case 'blocked_by_them':
        // Don't show blocked users in search
        return null;
        
      default: // 'none'
        buttonText = 'Add';
        buttonAction = () => handleAddFriend(item);
        buttonStyle = styles.quickAddButton;
        buttonContent = <UserPlus size={18} color="white" />;
        break;
    }
    
    return (
      <TouchableOpacity 
        style={styles.userItem}
        onPress={() => handleUserPress(item)}
      >
        <Image 
          source={{ uri: item.avatar_url || generateDefaultAvatar(item.name, item.id) }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
          {item.vibe && <Text style={styles.userVibe} numberOfLines={1}>{item.vibe}</Text>}
        </View>
        <TouchableOpacity
          style={buttonStyle}
          onPress={buttonAction}
          disabled={relationshipStatus === 'friends' || relationshipStatus === 'blocked_by_me'}
        >
          {buttonContent}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (searchQuery.length > 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateSubtext}>
            No users found for "{searchQuery}"
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        {/* Invite Friends Section - Always visible */}
        <TouchableOpacity style={styles.inviteCard} onPress={handleInviteFriends}>
          <View style={styles.actionIconContainer}>
            <Share2 size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Invite friends</Text>
            <Text style={styles.actionSubtitle}>
              freetohang.app/{currentUserUsername || 'mihkelkkk'}
            </Text>
          </View>
          <ChevronRight size={20} color={Colors.light.secondaryText} />
        </TouchableOpacity>

        {/* FIND CONTACTS SECTION - now first */}
        {showContactsList ? (
          <View style={styles.contactsContainer}>
            <View style={styles.contactsHeader}>
              <Text style={styles.contactsTitle}>
                {contactFriends.length > 0 ? 'Friends from Contacts' : 'No Contacts Found'}
              </Text>
              {/* Dev reset button */}
              <TouchableOpacity onPress={handleResetContacts} style={styles.resetButton}>
                <RotateCcw size={16} color={Colors.light.secondaryText} />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>
            
            {contactFriends.length > 0 ? (
              <FlatList
                data={contactFriends}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contactsList}
              />
            ) : (
              <View style={styles.noContactsContainer}>
                <Text style={styles.noContactsText}>No contacts match</Text>
                <Text style={styles.noContactsSubtext}>
                  None of your contacts are on Free to Hang yet
                </Text>
              </View>
            )}
          </View>
        ) : !contactsAccessGranted ? (
          <TouchableOpacity 
            style={styles.inviteCard} 
            onPress={() => setContactsModalVisible(true)}
          >
            <View style={styles.actionIconContainer}>
              <Users size={24} color={Colors.light.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Find contacts</Text>
              <Text style={styles.actionSubtitle}>Find friends from your contacts</Text>
            </View>
            <ChevronRight size={20} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        ) : null}

        {/* PENDING REQUESTS SECTION - now comes after contacts */}
        {outgoingRequests.length > 0 && (
          <View style={styles.contactsContainer}>
            <View style={styles.contactsHeader}>
              <Text style={styles.contactsTitle}>
                Pending Requests ({outgoingRequests.filter(req => !cancelledRequestIds.has(req.request_id)).length})
              </Text>
            </View>
            
            <FlatList
              data={outgoingRequests.filter(req => !cancelledRequestIds.has(req.request_id))}
              keyExtractor={(item) => item.request_id}
              renderItem={({ item }) => {
                // Convert FriendRequest to User format for rendering
                const userItem: User = {
                  id: item.receiver_id,
                  name: item.receiver_name || 'Unknown',
                  username: item.receiver_username || 'unknown',
                  avatar_url: item.receiver_avatar_url || '',
                  vibe: item.receiver_vibe,
                  relationshipStatus: 'pending_sent' as const
                };
                return renderSearchResult({ item: userItem });
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contactsList}
            />
          </View>
        )}

        {/* Default empty state - only show when no contacts and no pending requests */}
        {!showContactsList && outgoingRequests.length === 0 && (
          <View style={styles.defaultEmptyState}>
            <Search size={48} color={Colors.light.secondaryText} />
            <Text style={styles.emptyStateText}>Add friends</Text>
            <Text style={styles.emptyStateSubtext}>Just start typing a name or username</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add Friends</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={Colors.light.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.light.secondaryText} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or username"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                blurOnSubmit={false}
              />
              {isSearching && (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              )}
            </View>
            
            {/* Search Results */}
            <View style={styles.content}>
              {searchQuery.trim() ? (
                searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                ) : !isSearching ? (
                    <View style={styles.emptyState}>
                    <Search size={48} color={Colors.light.secondaryText} />
                    <Text style={styles.emptyStateText}>No users found</Text>
                    <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
                    </View>
                  ) : null
              ) : (
                renderEmptyState()
            )}
          </View>
          </View>
        </TouchableWithoutFeedback>

        {/* User Profile Modal */}
        <UserProfileModal
          visible={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          userId={selectedUser?.id || null}
        />

        {/* Contacts Access Modal */}
        <Modal
          visible={contactsModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setContactsModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setContactsModalVisible(false)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.newContactsModal}>
                  {/* Close Button */}
                  <TouchableOpacity 
                    onPress={() => setContactsModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <X size={20} color="#9CA3AF" />
                  </TouchableOpacity>

                  {/* Contact Emoji */}
                  <Text style={styles.contactEmoji}>📁</Text>

                  {/* Header */}
                  <Text style={styles.newContactsTitle}>
                    Find friends from your contacts
                  </Text>

                  {/* Allow Access Button */}
              <TouchableOpacity
                    onPress={handleRequestContactsAccess}
                    disabled={loadingContacts}
                    style={[styles.newContactsButton, loadingContacts && styles.disabledButton]}
                  >
                    <Users size={20} color="white" />
                    <Text style={styles.newContactsButtonText}>
                      {loadingContacts ? 'Checking Contacts...' : 'Allow Contacts Access'}
                    </Text>
                  </TouchableOpacity>

                  {/* Privacy Text */}
                  <Text style={styles.newPrivacyText}>
                    Your contacts remain private. Stop syncing anytime.
                </Text>
                  </View>
              </TouchableWithoutFeedback>
        </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 2,
  },
  userVibe: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
  quickAddButton: {
    backgroundColor: Colors.light.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingButton: {
    backgroundColor: '#E0E0E0',
    width: 60,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    padding: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  defaultEmptyState: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 40,
  },
  contactsModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    minHeight: 300,
    justifyContent: 'center',
  },
  contactsModalContent: {
    alignItems: 'center',
  },
  contactsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  contactsModalText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  openSettingsButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  openSettingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  privacyText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  // New contacts modal styles
  newContactsModal: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    margin: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
    position: 'relative',
  },
  contactEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  newContactsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  newContactsButton: {
    backgroundColor: Colors.light.primary,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  newContactsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  newPrivacyText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Contacts list styles
  contactsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  contactsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
  },
  resetText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    marginLeft: 4,
  },
  contactsList: {
    paddingVertical: 16,
  },
  noContactsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noContactsText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  noContactsSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 24,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: Colors.light.primary,
    width: 60,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  friendsButton: {
    backgroundColor: '#4CAF50',
    width: 60,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendsText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  blockedButton: {
    backgroundColor: '#757575',
    width: 60,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
}); 