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
  ActivityIndicator
} from 'react-native';
import { X, Search, UserPlus, Clock, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import useFriendsStore from '@/store/friendsStore';

interface AddFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddFriendsModal({ visible, onClose }: AddFriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'sent'>('search');
  
  const {
    searchResults,
    friendRequests,
    sentRequests,
    isSearching,
    isLoading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    loadFriendRequests,
    loadSentRequests,
    clearSearchResults
  } = useFriendsStore();

  useEffect(() => {
    if (visible) {
      loadFriendRequests();
      loadSentRequests();
    }
  }, [visible]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSendRequest = async (friendId: string) => {
    try {
      await sendFriendRequest(friendId);
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
    } catch (error) {
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const renderSearchResult = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
        {item.bio && <Text style={styles.userBio}>{item.bio}</Text>}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleSendRequest(item.id)}
        disabled={isLoading}
      >
        <UserPlus size={20} color="white" />
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFriendRequest = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.users.name}</Text>
        <Text style={styles.userUsername}>@{item.users.username}</Text>
        {item.users.bio && <Text style={styles.userBio}>{item.users.bio}</Text>}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptRequest(item.id)}
          disabled={isLoading}
        >
          <Check size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => handleDeclineRequest(item.id)}
          disabled={isLoading}
        >
          <X size={16} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequest = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.users.name}</Text>
        <Text style={styles.userUsername}>@{item.users.username}</Text>
        {item.users.bio && <Text style={styles.userBio}>{item.users.bio}</Text>}
      </View>
      <View style={styles.pendingIndicator}>
        <Clock size={16} color={Colors.light.secondaryText} />
        <Text style={styles.pendingText}>Pending</Text>
      </View>
    </View>
  );

  const getTabBadgeCount = (tab: string) => {
    switch (tab) {
      case 'requests':
        return friendRequests.length;
      case 'sent':
        return sentRequests.length;
      default:
        return 0;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'search':
        return (
          <View style={styles.tabContent}>
            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.light.secondaryText} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or username..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {isSearching && (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              )}
            </View>
            
            {searchQuery.trim() && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  !isSearching ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        {searchQuery.trim() ? 'No users found' : 'Start typing to search for friends'}
                      </Text>
                    </View>
                  ) : null
                }
              />
            )}
            
            {!searchQuery.trim() && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Search for friends by their name or username
                </Text>
              </View>
            )}
          </View>
        );
      
      case 'requests':
        return (
          <View style={styles.tabContent}>
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderFriendRequest}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No friend requests</Text>
                </View>
              }
            />
          </View>
        );
      
      case 'sent':
        return (
          <View style={styles.tabContent}>
            <FlatList
              data={sentRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderSentRequest}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No pending requests</Text>
                </View>
              }
            />
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Friends</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {[
            { key: 'search', title: 'Search' },
            { key: 'requests', title: 'Requests' },
            { key: 'sent', title: 'Sent' }
          ].map((tab) => {
            const badgeCount = getTabBadgeCount(tab.key);
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                  {tab.title}
                </Text>
                {badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        {renderTabContent()}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  activeTabText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: Colors.light.secondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
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
  userBio: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.light.onlineGreen,
  },
  declineButton: {
    backgroundColor: Colors.light.secondary,
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
}); 