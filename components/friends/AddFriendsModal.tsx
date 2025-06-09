import React, { useState, useEffect } from 'react';
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
  Keyboard
} from 'react-native';
import { X, Search, UserPlus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';

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

  // Search users based on name and username
  const searchUsers = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
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
      
      // Mark user as having pending request and update selected user too
      const updatedUser = { ...user, friendRequestSent: true };
      setSearchResults(prev => prev.map(u => 
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
      
      // Mark user as not having pending request
      const updatedUser = { ...user, friendRequestSent: false };
      setSearchResults(prev => prev.map(u => 
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
                <View style={styles.emptyState}>
                  <Search size={48} color={Colors.light.secondaryText} />
                  <Text style={styles.emptyStateText}>Add friends</Text>
                  <Text style={styles.emptyStateSubtext}>Just start typing a name or username</Text>
                </View>
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
}); 