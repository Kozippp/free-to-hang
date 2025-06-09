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

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  vibe?: string;
  friendRequestSent?: boolean;
}

interface AddFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddFriendsModal({ visible, onClose }: AddFriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
      'This feature will be available soon. We\'ll help you find friends from your contacts.',
      [{ text: 'OK' }]
    );
    setShowContactsModal(false);
  };

  // Search users based on name and username
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      console.log('Searching for users with query:', query.trim());

      // Search by username and name - supports partial matches anywhere in the string
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, vibe')
        .or(`username.ilike.%${query.trim()}%,name.ilike.%${query.trim()}%`)
        .neq('id', currentUser.id) // Exclude current user
        .limit(20);

      console.log('Search results from database:', users?.length || 0, 'users found');

      if (error) {
        console.error('Search error:', error);
        return;
      }

      // Filter out users who are already friends (accepted) or blocked, but keep pending requests
      const { data: existingConnections } = await supabase
        .from('friends')
        .select('friend_id, status')
        .eq('user_id', currentUser.id);

      const blockedOrFriendIds = existingConnections?.filter((conn: any) => 
        conn.status === 'accepted' || conn.status === 'blocked'
      ).map((conn: any) => conn.friend_id) || [];
      
      const pendingIds = existingConnections?.filter((conn: any) => 
        conn.status === 'pending'
      ).map((conn: any) => conn.friend_id) || [];

      const filteredUsers = users?.filter((user: any) => !blockedOrFriendIds.includes(user.id)) || [];
      
      // Mark users with pending requests
      const usersWithStatus = filteredUsers.map((user: any) => ({
        ...user,
        friendRequestSent: pendingIds.includes(user.id)
      }));

      console.log('Final search results:', usersWithStatus?.length || 0, 'users');

      setSearchResults(usersWithStatus);
      
      // Also update contact friends if they overlap
      if (contactFriends.length > 0) {
        setContactFriends(prev => prev.map(contactUser => {
          const matchingSearchUser = usersWithStatus.find((u: any) => u.id === contactUser.id);
          return matchingSearchUser ? { ...contactUser, friendRequestSent: matchingSearchUser.friendRequestSent } : contactUser;
        }));
    }
    } catch (error) {
      console.error('Search users error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setShowUserProfile(false);
      setShowContactsModal(false);
    }
  }, [visible]);

  const handleUserPress = (user: User) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleAddFriend = async (user: User) => {
    if (user.friendRequestSent) return;
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('friends')
        .insert([
          { user_id: currentUser.id, friend_id: user.id, status: 'pending' }
        ]);

      if (error) {
        console.error('Send friend request error:', error);
        Alert.alert('Error', 'Failed to send friend request');
        return;
      }
      
      // Mark user as having pending request and update both search results and contact friends
      const updatedUser = { ...user, friendRequestSent: true };
      
      setSearchResults(prev => prev.map(u => 
        u.id === user.id ? updatedUser : u
      ));
      
      setContactFriends(prev => prev.map(u => 
        u.id === user.id ? updatedUser : u
      ));
      
      // Update selected user in profile modal
      if (selectedUser?.id === user.id) {
        setSelectedUser(updatedUser);
      }
      
    } catch (error) {
      console.error('Add friend error:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleUndoFriendRequest = async (user: User) => {
    if (!user.friendRequestSent) return;
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Undo friend request error:', error);
        Alert.alert('Error', 'Failed to undo friend request');
        return;
      }
      
      // Mark user as not having pending request and update both search results and contact friends
      const updatedUser = { ...user, friendRequestSent: false };
      
      setSearchResults(prev => prev.map(u => 
        u.id === user.id ? updatedUser : u
      ));
      
      setContactFriends(prev => prev.map(u => 
        u.id === user.id ? updatedUser : u
      ));
      
      // Update selected user in profile modal
      if (selectedUser?.id === user.id) {
        setSelectedUser(updatedUser);
      }
      
    } catch (error) {
      console.error('Undo friend request error:', error);
      Alert.alert('Error', 'Failed to undo friend request');
    }
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
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) return;

          let matchingUsers: any[] = [];

          // Search by emails first
          if (contactEmails.length > 0) {
            const emailFilter = contactEmails.map(email => `email.eq.${email}`).join(',');

            const { data: emailMatches, error: emailError } = await supabase
              .from('users')
              .select('id, name, username, avatar_url, vibe, email')
              .or(emailFilter)
              .neq('id', currentUser.id)
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
              .neq('id', currentUser.id)
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
          
          // Filter out already connected friends and mark pending requests
          const { data: existingConnections } = await supabase
            .from('friends')
            .select('friend_id, status')
            .eq('user_id', currentUser.id);

          const blockedOrFriendIds = existingConnections?.filter((conn: any) => 
            conn.status === 'accepted' || conn.status === 'blocked'
          ).map((conn: any) => conn.friend_id) || [];
          
          const pendingIds = existingConnections?.filter((conn: any) => 
            conn.status === 'pending'
          ).map((conn: any) => conn.friend_id) || [];

          const availableUsers = matchingUsers.filter((user: any) => 
            !blockedOrFriendIds.includes(user.id)
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

  const renderSearchResult = ({ item }: { item: User }) => (
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
        style={[styles.quickAddButton, item.friendRequestSent && styles.pendingButton]}
        onPress={() => item.friendRequestSent ? handleUndoFriendRequest(item) : handleAddFriend(item)}
      >
        {item.friendRequestSent ? (
          <Text style={styles.pendingText}>Pending</Text>
        ) : (
          <UserPlus size={18} color="white" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

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

        {/* Contacts Section */}
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

        {/* Default empty state - only show when no contacts */}
        {!showContactsList && (
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
        <Modal
          visible={showUserProfile}
          animationType="fade"
          transparent={true}
        >
          <TouchableOpacity 
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowUserProfile(false)}
          >
            <TouchableOpacity 
              style={styles.profileModal}
              activeOpacity={1}
              onPress={() => {}} // Prevent closing when clicking inside modal
            >
              {selectedUser && (
                <>
                  {/* Close Button */}
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setShowUserProfile(false)}
                  >
                    <X size={20} color={Colors.light.secondaryText} />
                  </TouchableOpacity>

                  {/* Profile Picture */}
                  <Image 
                    source={{ uri: selectedUser.avatar_url || generateDefaultAvatar(selectedUser.name, selectedUser.id) }} 
                    style={styles.profileAvatar} 
                  />
                  
                  {/* Name & Username */}
                  <Text style={styles.profileName}>{selectedUser.name}</Text>
                  <Text style={styles.profileUsername}>@{selectedUser.username}</Text>
                  
                  {/* Vibe */}
                  {selectedUser.vibe && (
                    <Text style={styles.profileVibe}>{selectedUser.vibe}</Text>
                  )}
                  
                  {/* Add Friend Button */}
                  <TouchableOpacity
                    style={[
                      styles.addFriendButton, 
                      selectedUser.friendRequestSent && styles.profilePendingButton
                    ]}
                    onPress={() => selectedUser.friendRequestSent ? handleUndoFriendRequest(selectedUser) : handleAddFriend(selectedUser)}
                  >
                    {selectedUser.friendRequestSent ? (
                      <Text style={[styles.addFriendText, { color: '#999999' }]}>Pending</Text>
                    ) : (
                      <>
                        <UserPlus size={20} color="white" />
                        <Text style={styles.addFriendText}>Add Friend</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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
  // Profile Modal Styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
    position: 'relative',
  },
  profileAvatar: {
    width: 112, // 40% larger than 80px
    height: 112,
    borderRadius: 56,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  profileVibe: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  addFriendButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24, // Made wider
    borderRadius: 12,
    gap: 8,
    minWidth: 160, // Ensure minimum width
  },
  addFriendText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  profilePendingButton: {
    backgroundColor: '#E0E0E0',
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
}); 