import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, UserPlus, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import useFriendsStore from '@/store/friendsStore';

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  vibe?: string;
  friendRequestSent?: boolean;
  isLoading?: boolean;
}

interface AddFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddFriendsModal({ visible, onClose }: AddFriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const friendsStore = useFriendsStore();

  // Search users function
  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, vibe')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .eq('onboarding_completed', true)
        .limit(20);

      if (error) {
        console.error('Search users error:', error);
        return;
      }

      // Check for existing friend requests and friendships
      const userIds = users?.map((user: any) => user.id) || [];
      
      if (userIds.length > 0) {
        // Check for existing friendships
        const { data: existingFriendships, error: friendshipError } = await supabase
          .from('friendships')
          .select('friend_id')
          .eq('user_id', currentUser.id);

        if (friendshipError) {
          console.error('Error checking friendships:', friendshipError);
          return;
        }

        // Check for existing friend requests (both directions)
        const { data: existingRequests, error: requestError } = await supabase
          .from('friend_requests')
          .select('receiver_id, sender_id')
          .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

        if (requestError && requestError.code !== 'PGRST116') {
          console.error('Error checking friend requests:', requestError);
          return;
        }

        const friendIds = existingFriendships?.map((f: any) => f.friend_id) || [];
        const requestUserIds = existingRequests?.map((r: any) =>
          r.sender_id === currentUser.id ? r.receiver_id : r.sender_id
        ) || [];

        const filteredUsers = users?.filter((user: any) =>
          !friendIds.includes(user.id) &&
          !requestUserIds.includes(user.id) &&
          user.id !== currentUser.id
        ) || [];

        setSearchResults(filteredUsers);
      } else {
        setSearchResults(users || []);
      }

    } catch (error) {
      console.error('Search users error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleAddFriend = async (user: User) => {
    if (user.friendRequestSent || user.isLoading) return;
    
    try {
      // Add loading state to the specific user
      setSearchResults(prev => prev.map(u => 
        u.id === user.id ? { ...u, isLoading: true } : u
      ));

      // Use friendsStore to send friend request
      await friendsStore.sendFriendRequest(user.id);
      
      // Mark user as having pending request
      setSearchResults(prev => prev.map(u => 
        u.id === user.id ? { ...u, friendRequestSent: true, isLoading: false } : u
      ));

      console.log(`Friend request sent to ${user.name}`);
      
    } catch (error) {
      console.error('Add friend error:', error);
      
      // Remove loading state on error
      setSearchResults(prev => prev.map(u => 
        u.id === user.id ? { ...u, isLoading: false } : u
      ));
      
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => {
        setSelectedUser(item);
        setShowUserProfile(true);
      }}
    >
      <Image 
        source={{ 
          uri: item.avatar_url || generateDefaultAvatar(item.name, item.id) 
        }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
        {item.vibe && <Text style={styles.userVibe}>{item.vibe}</Text>}
      </View>
      <TouchableOpacity
        style={[
          styles.addButton,
          (item.friendRequestSent || item.isLoading) && styles.addButtonDisabled
        ]}
        onPress={() => handleAddFriend(item)}
        disabled={item.friendRequestSent || item.isLoading}
      >
        {item.isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : item.friendRequestSent ? (
          <Text style={styles.addButtonText}>Sent</Text>
        ) : (
          <UserPlus size={20} color="white" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.emptyStateText}>Searching...</Text>
        </View>
      );
    }

    if (searchQuery.trim().length === 0) {
      return (
        <View style={styles.emptyState}>
          <Users size={48} color={Colors.light.secondaryText} />
          <Text style={styles.emptyStateText}>Search for friends by name or username</Text>
        </View>
      );
    }

    if (searchResults.length === 0 && searchQuery.trim().length > 0) {
      return (
        <View style={styles.emptyState}>
          <Users size={48} color={Colors.light.secondaryText} />
          <Text style={styles.emptyStateText}>No users found</Text>
          <Text style={styles.emptyStateSubtext}>Try searching with different keywords</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Friends</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={Colors.light.secondaryText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.light.secondaryText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        {/* User Profile Modal */}
        {selectedUser && (
          <Modal 
            visible={showUserProfile} 
            animationType="slide" 
            presentationStyle="pageSheet"
          >
            <SafeAreaView style={styles.profileContainer}>
              <View style={styles.profileHeader}>
                <TouchableOpacity onPress={() => setShowUserProfile(false)}>
                  <X size={24} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.profileContent}>
                <Image 
                  source={{ 
                    uri: selectedUser.avatar_url || generateDefaultAvatar(selectedUser.name, selectedUser.id) 
                  }}
                  style={styles.profileAvatar}
                />
                <Text style={styles.profileName}>{selectedUser.name}</Text>
                <Text style={styles.profileUsername}>@{selectedUser.username}</Text>
                {selectedUser.vibe && (
                  <Text style={styles.profileVibe}>{selectedUser.vibe}</Text>
                )}
                
                <TouchableOpacity
                  style={[
                    styles.profileAddButton,
                    (selectedUser.friendRequestSent || selectedUser.isLoading) && styles.addButtonDisabled
                  ]}
                  onPress={() => handleAddFriend(selectedUser)}
                  disabled={selectedUser.friendRequestSent || selectedUser.isLoading}
                >
                  {selectedUser.isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : selectedUser.friendRequestSent ? (
                    <Text style={styles.addButtonText}>Request Sent</Text>
                  ) : (
                    <>
                      <UserPlus size={20} color="white" />
                      <Text style={styles.addButtonText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.buttonBackground,
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
  addButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.light.secondaryText,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
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
  profileContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  profileContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  profileAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.buttonBackground,
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  profileUsername: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  profileVibe: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
    marginBottom: 40,
    textAlign: 'center',
  },
  profileAddButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
}); 