import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView,
  Alert,
  Switch,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import { 
  Settings, 
  Edit3, 
  Eye, 
  Share, 
  UserX, 
  Shield, 
  X,
  LogOut,
  Smartphone,
  Bell,
  Lock,
  Users,
  UserPlus,
  Search,
  Camera,
  EyeOff,
  ChevronRight
} from 'lucide-react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { 
  Friend, 
  UserProfile, 
  AppSettings, 
  profileFriends, 
  mockUserProfile, 
  mockBlockedUsers, 
  defaultSettings 
} from '@/constants/mockData';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile>(mockUserProfile);
  const [friends, setFriends] = useState<Friend[]>(profileFriends);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>(mockBlockedUsers);
  
  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendDetail, setShowFriendDetail] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  
  // Edit profile states
  const [editUsername, setEditUsername] = useState(userProfile.email.split('@')[0]);
  const [editName, setEditName] = useState(userProfile.name);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editEmail, setEditEmail] = useState(userProfile.email);
  
  // Add friend states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);

  const handleEditProfile = () => {
    setUserProfile({
      ...userProfile,
      name: editName,
      bio: editBio,
      email: editEmail
    });
    setShowEditProfile(false);
    Alert.alert('Profile Updated', 'Your profile has been successfully updated.');
  };

  const handleChangeProfilePicture = () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose a photo or take a picture',
      [
        { text: 'Camera', onPress: () => Alert.alert('Camera', 'Camera functionality would be implemented here') },
        { text: 'Gallery', onPress: () => Alert.alert('Gallery', 'Gallery functionality would be implemented here') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleSearchFriends = (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      // Mock search results - in real app this would be an API call
      const mockResults: Friend[] = [
        {
          id: 'search1',
          name: 'Mari Kask',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
          status: 'online' as const,
          lastAvailable: '5 minutes ago',
          shareAvailability: 'week' as const,
          isBlocked: false
        },
        {
          id: 'search2',
          name: 'Jaan Tamm',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
          status: 'offline' as const,
          lastAvailable: '2 hours ago',
          shareAvailability: 'today' as const,
          isBlocked: false
        }
      ].filter(user => 
        user.name.toLowerCase().includes(query.toLowerCase()) &&
        !friends.some(f => f.id === user.id)
      );
      setSearchResults(mockResults);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddFriend = (friendToAdd: Friend) => {
    setFriends([...friends, friendToAdd]);
    setSearchResults(searchResults.filter(f => f.id !== friendToAdd.id));
    Alert.alert('Friend Added', `${friendToAdd.name} is now your friend!`);
  };

  const handleFriendTap = (friend: Friend) => {
    setSelectedFriend(friend);
    setShowFriendDetail(true);
  };

  const handleShareAvailabilityToggle = (friendId: string) => {
    Alert.alert(
      'Share Availability',
      'How long should this friend see when you\'re free to hang?',
      [
        { text: 'Never', onPress: () => updateShareAvailability(friendId, 'never') },
        { text: 'Today Only', onPress: () => updateShareAvailability(friendId, 'today') },
        { text: 'Next 7 Days', onPress: () => updateShareAvailability(friendId, 'week') },
        { text: 'Forever', onPress: () => updateShareAvailability(friendId, 'forever') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const updateShareAvailability = (friendId: string, availability: Friend['shareAvailability']) => {
    setFriends(friends.map(friend => 
      friend.id === friendId 
        ? { ...friend, shareAvailability: availability }
        : friend
    ));
  };

  const handleRemoveFriend = (friendId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setFriends(friends.filter(f => f.id !== friendId));
            setShowFriendDetail(false);
          }
        }
      ]
    );
  };

  const handleBlockUser = (friendId: string) => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: () => {
            const friendToBlock = friends.find(f => f.id === friendId);
            if (friendToBlock) {
              setBlockedUsers([...blockedUsers, { ...friendToBlock, isBlocked: true }]);
              setFriends(friends.filter(f => f.id !== friendId));
              setShowFriendDetail(false);
            }
          }
        }
      ]
    );
  };

  const handleHideStatus = (friendId: string) => {
    Alert.alert(
      'Hide Status',
      'Are you sure you want to hide your online status from this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Hide Status', 
          onPress: () => {
            // In a real app, this would update the friend's settings
            Alert.alert('Status Hidden', 'Your online status is now hidden from this friend.');
            setShowFriendDetail(false);
          }
        }
      ]
    );
  };

  const handleUnblockUser = (userId: string) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock', 
          onPress: () => {
            const userToUnblock = blockedUsers.find(u => u.id === userId);
            if (userToUnblock) {
              setFriends([...friends, { ...userToUnblock, isBlocked: false }]);
              setBlockedUsers(blockedUsers.filter(u => u.id !== userId));
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logi välja',
      'Kas oled kindel, et tahad välja logida?',
      [
        { text: 'Tühista', style: 'cancel' },
        { 
          text: 'Logi välja', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Viga', 'Väljalogimine ebaõnnestus');
            }
          }
        }
      ]
    );
  };

  const updateNotificationSetting = (setting: keyof AppSettings['notifications'], value: boolean) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [setting]: value
      }
    });
  };

  const updatePrivacySetting = (setting: keyof AppSettings['privacy'], value: boolean) => {
    setSettings({
      ...settings,
      privacy: {
        ...settings.privacy,
        [setting]: value
      }
    });
  };

  const getStatusColor = (status: Friend['status']) => {
    switch (status) {
      case 'available': return Colors.light.onlineGreen;
      case 'online': return '#FFC107';
      case 'offline': return Colors.light.secondaryText;
      default: return Colors.light.secondaryText;
    }
  };

  const getAvailabilityText = (availability: Friend['shareAvailability']) => {
    switch (availability) {
      case 'today': return 'Today';
      case 'week': return '7 days';
      case 'forever': return 'Always';
      case 'never': return 'Never';
      default: return 'Never';
    }
  };

  const getFriendHangingPreference = (friendId: string) => {
    // Mock data for what friends like to do - in real app this would come from their profile
    const preferences: { [key: string]: string } = {
      'user1': 'Loves coffee dates, outdoor walks, and trying new restaurants',
      'user2': 'Into fitness activities, hiking, and sports events',
      'user3': 'Enjoys movies, art galleries, and cozy indoor activities',
      'user4': 'Prefers casual hangouts, gaming, and late-night conversations',
      'user5': 'Loves adventures, road trips, and spontaneous activities',
      'user6': 'Into cultural events, concerts, and intellectual discussions'
    };
    return preferences[friendId] || 'Enjoys various activities and meeting new people';
  };

  const sortedFriends = friends.sort((a, b) => {
    const statusOrder = { 'available': 0, 'online': 1, 'offline': 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity 
      style={styles.friendCard}
      onPress={() => handleFriendTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendLastSeen}>
            {item.status === 'available' ? 'Free to hang' : `Last available ${item.lastAvailable}`}
          </Text>
        </View>
      </View>
      
      <ChevronRight size={20} color={Colors.light.secondaryText} />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Profile",
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 20,
            color: Colors.light.primary,
          },
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowSettings(true)}>
              <Settings size={24} color={Colors.light.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Profile Preview Section */}
          <TouchableOpacity 
            style={styles.profilePreview}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <Image source={{ uri: userProfile.avatar }} style={styles.profilePreviewImage} />
            <View style={styles.profilePreviewInfo}>
              <Text style={styles.profilePreviewName}>{userProfile.name}</Text>
              <Text style={styles.profilePreviewUsername}>@{editUsername}</Text>
              <Text style={styles.profilePreviewBio} numberOfLines={2}>{userProfile.bio}</Text>
            </View>
            <Edit3 size={20} color={Colors.light.primary} />
          </TouchableOpacity>
          
          {/* Friends Section */}
          <View style={styles.friendsSection}>
            <View style={styles.friendsHeader}>
              <View style={styles.friendsHeaderLeft}>
                <Users size={20} color={Colors.light.text} />
                <Text style={styles.friendsTitle}>Friends ({friends.length})</Text>
              </View>
              <TouchableOpacity 
                style={styles.addFriendButton}
                onPress={() => setShowAddFriend(true)}
              >
                <UserPlus size={18} color={Colors.light.primary} />
                <Text style={styles.addFriendText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {friends.length > 0 ? (
              <FlatList
                data={sortedFriends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.friendsList}
              />
            ) : (
              <View style={styles.emptyFriends}>
                <Users size={48} color={Colors.light.secondaryText} />
                <Text style={styles.emptyFriendsText}>Seems quiet here</Text>
                <Text style={styles.emptyFriendsSubtext}>Add more friends to see when they are available</Text>
                <TouchableOpacity 
                  style={styles.emptyAddFriendButton}
                  onPress={() => setShowAddFriend(true)}
                >
                  <UserPlus size={18} color="white" />
                  <Text style={styles.emptyAddFriendText}>Add friends</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Friend Detail Modal */}
      <Modal
        visible={showFriendDetail}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Friend Details</Text>
            <TouchableOpacity onPress={() => setShowFriendDetail(false)}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          {selectedFriend && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.friendDetailContent}>
                {/* Friend Info */}
                <View style={styles.friendDetailHeader}>
                  <Image source={{ uri: selectedFriend.avatar }} style={styles.friendDetailAvatar} />
                  <View style={styles.friendDetailInfo}>
                    <Text style={styles.friendDetailName}>{selectedFriend.name}</Text>
                    <Text style={styles.friendDetailUsername}>@{selectedFriend.name.toLowerCase().replace(' ', '')}</Text>
                    <View style={styles.friendDetailStatus}>
                      <View style={[styles.friendDetailStatusDot, { backgroundColor: getStatusColor(selectedFriend.status) }]} />
                      <Text style={styles.friendDetailStatusText}>
                        {selectedFriend.status === 'available' ? 'Available to hang' : 
                         selectedFriend.status === 'online' ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* What they like to do */}
                <View style={styles.hangingPreferencesSection}>
                  <Text style={styles.sectionLabel}>What they usually like to do when hanging</Text>
                  <Text style={styles.hangingPreferencesText}>
                    {getFriendHangingPreference(selectedFriend.id)}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.friendActionsSection}>
                  <TouchableOpacity 
                    style={styles.friendActionButton}
                    onPress={() => handleShareAvailabilityToggle(selectedFriend.id)}
                  >
                    <Share size={20} color={Colors.light.primary} />
                    <View style={styles.friendActionTextContainer}>
                      <Text style={styles.friendActionTitle}>Share Availability</Text>
                      <Text style={styles.friendActionSubtitle}>
                        Currently: {getAvailabilityText(selectedFriend.shareAvailability)}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={Colors.light.secondaryText} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.friendActionButton}
                    onPress={() => handleHideStatus(selectedFriend.id)}
                  >
                    <EyeOff size={20} color={Colors.light.secondaryText} />
                    <View style={styles.friendActionTextContainer}>
                      <Text style={styles.friendActionTitle}>Hide Your Status</Text>
                      <Text style={styles.friendActionSubtitle}>
                        Hide your online status from this friend
                      </Text>
                    </View>
                    <ChevronRight size={20} color={Colors.light.secondaryText} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.friendActionButton}
                    onPress={() => handleRemoveFriend(selectedFriend.id)}
                  >
                    <UserX size={20} color={Colors.light.destructive} />
                    <View style={styles.friendActionTextContainer}>
                      <Text style={[styles.friendActionTitle, { color: Colors.light.destructive }]}>Remove Friend</Text>
                      <Text style={styles.friendActionSubtitle}>
                        Remove this person from your friends list
                      </Text>
                    </View>
                    <ChevronRight size={20} color={Colors.light.secondaryText} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.friendActionButton}
                    onPress={() => handleBlockUser(selectedFriend.id)}
                  >
                    <Shield size={20} color={Colors.light.destructive} />
                    <View style={styles.friendActionTextContainer}>
                      <Text style={[styles.friendActionTitle, { color: Colors.light.destructive }]}>Block Friend</Text>
                      <Text style={styles.friendActionSubtitle}>
                        Block this person completely
                      </Text>
                    </View>
                    <ChevronRight size={20} color={Colors.light.secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.editForm}>
              {/* Profile Picture */}
              <View style={styles.profilePictureSection}>
                <TouchableOpacity 
                  style={styles.profilePictureContainer}
                  onPress={handleChangeProfilePicture}
                >
                  <Image source={{ uri: userProfile.avatar }} style={styles.editProfileImage} />
                  <View style={styles.cameraOverlay}>
                    <Camera size={20} color="white" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.profilePictureText}>Tap image to change</Text>
              </View>

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="username"
              />
              
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <Text style={styles.inputLabel}>Bio (max 120 characters)</Text>
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                value={editBio}
                onChangeText={(text) => text.length <= 120 && setEditBio(text)}
                placeholder="Tell others about yourself..."
                multiline
                maxLength={120}
              />
              <Text style={styles.characterCount}>{editBio.length}/120</Text>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleEditProfile}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddFriend}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={() => setShowAddFriend(false)}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.light.secondaryText} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username or name..."
                value={searchQuery}
                onChangeText={handleSearchFriends}
                autoCapitalize="none"
              />
            </View>
            
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={({ item }) => (
                  <View style={styles.searchResultCard}>
                    <Image source={{ uri: item.avatar }} style={styles.searchResultAvatar} />
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      <Text style={styles.searchResultStatus}>
                        {item.status === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => handleAddFriend(item)}
                    >
                      <UserPlus size={18} color="white" />
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
                keyExtractor={(item) => item.id}
                style={styles.searchResults}
              />
            ) : searchQuery.length > 2 ? (
              <View style={styles.noResults}>
                <Search size={48} color={Colors.light.secondaryText} />
                <Text style={styles.noResultsText}>No users found</Text>
                <Text style={styles.noResultsSubtext}>Try a different search</Text>
              </View>
            ) : (
              <View style={styles.searchInstructions}>
                <Search size={48} color={Colors.light.secondaryText} />
                <Text style={styles.searchInstructionsText}>Start searching</Text>
                <Text style={styles.searchInstructionsSubtext}>Enter at least 3 characters</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
        
      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Notifications */}
            <View style={styles.settingsSection}>
              <View style={styles.sectionHeader}>
                <Bell size={20} color={Colors.light.text} />
                <Text style={styles.sectionTitle}>Push Notifications</Text>
              </View>
              
              {Object.entries(settings.notifications).map(([key, value]) => (
                <View key={key} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>
                    {key === 'friendInvitation' && 'Friend Invitation'}
                    {key === 'planSuggestion' && 'New Plan Suggestion'}
                    {key === 'newPoll' && 'New Poll'}
                    {key === 'pollWinner' && 'Poll Winner'}
                    {key === 'newChats' && 'New Chats'}
                  </Text>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => updateNotificationSetting(key as keyof AppSettings['notifications'], newValue)}
                    trackColor={{ false: '#E0E0E0', true: Colors.light.primary + '40' }}
                    thumbColor={value ? Colors.light.primary : '#F4F3F4'}
                  />
                </View>
              ))}
            </View>
            
            {/* Privacy */}
            <View style={styles.settingsSection}>
              <View style={styles.sectionHeader}>
                <Lock size={20} color={Colors.light.text} />
                <Text style={styles.sectionTitle}>Privacy</Text>
              </View>
              
              {Object.entries(settings.privacy).map(([key, value]) => (
                <View key={key} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>
                    {key === 'showOnlineStatus' && 'Show Online Status'}
                    {key === 'allowAnonymousInvites' && 'Allow Anonymous Invites'}
                  </Text>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => updatePrivacySetting(key as keyof AppSettings['privacy'], newValue)}
                    trackColor={{ false: '#E0E0E0', true: Colors.light.primary + '40' }}
                    thumbColor={value ? Colors.light.primary : '#F4F3F4'}
                  />
                </View>
              ))}
            </View>
            
            {/* Blocked Users */}
            <View style={styles.settingsSection}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => setShowBlockedUsers(true)}
              >
                <Shield size={20} color={Colors.light.text} />
                <Text style={styles.sectionTitle}>Blocked Users ({blockedUsers.length})</Text>
              </TouchableOpacity>
            </View>
            
            {/* Device Info */}
            <View style={styles.settingsSection}>
              <View style={styles.sectionHeader}>
                <Smartphone size={20} color={Colors.light.text} />
                <Text style={styles.sectionTitle}>Device Info</Text>
              </View>
              
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceInfoText}>App Version: 1.0.0</Text>
                <Text style={styles.deviceInfoText}>Username: @{editUsername}</Text>
                <Text style={styles.deviceInfoText}>Email: {userProfile.email}</Text>
                <Text style={styles.deviceInfoText}>Joined: {userProfile.joinedDate}</Text>
              </View>
            </View>
            
            {/* Logout */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color={Colors.light.destructive} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
        
      {/* Blocked Users Modal */}
      <Modal
        visible={showBlockedUsers}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Blocked Users</Text>
            <TouchableOpacity onPress={() => setShowBlockedUsers(false)}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            {blockedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Shield size={48} color={Colors.light.secondaryText} />
                <Text style={styles.emptyStateText}>No blocked users</Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsers}
                renderItem={({ item }) => (
                  <View style={styles.blockedUserCard}>
                    <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
                    <View style={styles.friendDetails}>
                      <Text style={styles.friendName}>{item.name}</Text>
                      <Text style={styles.friendLastSeen}>Blocked</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.unblockButton}
                      onPress={() => handleUnblockUser(item.id)}
                    >
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                )}
                keyExtractor={(item) => item.id}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContainer: {
    flex: 1,
  },
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
    marginBottom: 20,
  },
  profilePreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 16,
  },
  profilePreviewInfo: {
    flex: 1,
  },
  profilePreviewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 2,
  },
  profilePreviewUsername: {
    fontSize: 14,
    color: Colors.light.primary,
    marginBottom: 4,
  },
  profilePreviewBio: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    lineHeight: 18,
  },
  friendsSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  friendsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary + '20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addFriendText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
    marginLeft: 4,
  },
  friendsList: {
    paddingBottom: 40,
  },
  emptyFriends: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyFriendsText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFriendsSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 24,
  },
  emptyAddFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptyAddFriendText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.buttonBackground,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.buttonBackground,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  friendLastSeen: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  friendDetailContent: {
    flex: 1,
  },
  friendDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  friendDetailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 16,
  },
  friendDetailInfo: {
    flex: 1,
  },
  friendDetailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  friendDetailUsername: {
    fontSize: 16,
    color: Colors.light.primary,
    marginBottom: 8,
  },
  friendDetailStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendDetailStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  friendDetailStatusText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  hangingPreferencesSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  hangingPreferencesText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    lineHeight: 22,
    backgroundColor: Colors.light.buttonBackground,
    padding: 16,
    borderRadius: 12,
  },
  friendActionsSection: {
    flex: 1,
  },
  friendActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.buttonBackground,
  },
  friendActionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  friendActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  friendActionSubtitle: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  editForm: {
    flex: 1,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  editProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.buttonBackground,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.light.buttonBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: Colors.light.secondaryText,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: 12,
  },
  searchResults: {
    flex: 1,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.buttonBackground,
  },
  searchResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.buttonBackground,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  searchResultStatus: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  searchInstructions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchInstructionsText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  searchInstructionsSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  deviceInfo: {
    paddingLeft: 28,
  },
  deviceInfoText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.light.destructive + '20',
    borderRadius: 8,
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.destructive,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginTop: 16,
  },
  blockedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.buttonBackground,
  },
  unblockButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.background,
  },
});