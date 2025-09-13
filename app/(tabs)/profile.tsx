import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  ChevronRight,
  Check,
  User
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
import useHangStore from '@/store/hangStore';
import { supabase } from '@/lib/supabase';
import AddFriendsModal from '@/components/friends/AddFriendsModal';
import UserProfileModal from '@/components/UserProfileModal';
import useFriendsStore from '@/store/friendsStore';
import { generateDefaultAvatar } from '@/constants/defaultImages';
import { uploadImage, deleteImage } from '@/lib/storage';

export default function ProfileScreen() {
  const { signOut, user: authUser } = useAuth();
  const { user, friends, offlineFriends, loadUserData, loadFriends, updateUserData } = useHangStore();
  
  // Use real friends store for friend requests and relationships
  const {
    incomingRequests,
    outgoingRequests,
    friends: storeFriends,
    isLoading,
    acceptFriendRequest,
    declineFriendRequest,
    loadAllRelationships,
    forceRefresh,
    startRealTimeUpdates,
    stopRealTimeUpdates
  } = useFriendsStore();
  
  // Blocked users functionality not implemented yet
  const blockedUsers: any[] = [];
  const unblockUser = (userId: string) => {};
  
  // Use real user data from hangStore, fallback to mock for missing fields
  const [userProfile, setUserProfile] = useState<UserProfile>({
    ...mockUserProfile,
    name: user.name || mockUserProfile.name,
    email: authUser?.email || mockUserProfile.email,
    avatar: user.avatar || mockUserProfile.avatar,
    bio: user.vibe || '', // Use vibe from sign up as bio
  });
  
  // Local state - friends and blocked users come from useFriendsStore
  const [allFriends, setAllFriends] = useState<Friend[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [refreshing, setRefreshing] = useState(false);
  
  // Friend relationships disabled - no loading needed

  // Start friends realtime when profile tab mounts
  useEffect(() => {
    if (authUser) {
      console.log('👥 Starting friends realtime in profile tab...');
      startRealTimeUpdates();

      // Load initial friend data
      loadAllRelationships();
    }

    // Stop realtime when leaving profile tab
    return () => {
      console.log('👥 Stopping friends realtime when leaving profile tab...');
      stopRealTimeUpdates();
    };
  }, [authUser, startRealTimeUpdates, stopRealTimeUpdates, loadAllRelationships]);

  // Update local state when hangStore data changes
  useEffect(() => {
    setUserProfile(prev => ({
      ...prev,
      name: user.name || prev.name,
      email: authUser?.email || prev.email,
      avatar: user.avatar || prev.avatar,
      bio: user.vibe || prev.bio, // Update bio with vibe from database
    }));
  }, [user, authUser]);

  // Update edit states when user data changes
  useEffect(() => {
    setEditName(user.name || userProfile.name);
    setEditUsername(user.username || userProfile.email.split('@')[0]);
    setEditBio(user.vibe || ''); // Load vibe from database as bio
    setEditAvatar(user.avatar || userProfile.avatar);
    setOriginalUsername(user.username || userProfile.email.split('@')[0]); // Store original username
    setOriginalName(user.name || userProfile.name);
    setOriginalBio(user.vibe || '');
    setOriginalAvatar(user.avatar || userProfile.avatar);
  }, [user, userProfile]);

  // Use friends from friendsStore (real-time updates with instant cache bypass)
  useEffect(() => {
    const friendsFromStore = storeFriends.map(friend => ({
      id: friend.friend_id,
      name: friend.friend_name,
      avatar: friend.friend_avatar_url || generateDefaultAvatar(friend.friend_name, friend.friend_id),
      status: 'offline' as const, // Friends are just relationships, status tracking is separate
      lastAvailable: 'Recently',
      shareAvailability: 'week' as const, // Default value
      isBlocked: false
    }));
    setAllFriends(friendsFromStore);
  }, [storeFriends]);
  
  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showRequestProfile, setShowRequestProfile] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  
  // Edit profile states
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState(userProfile.name);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editEmail, setEditEmail] = useState(userProfile.email);
  const [editAvatar, setEditAvatar] = useState(userProfile.avatar);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  // Username validation states for edit profile
  const [originalUsername, setOriginalUsername] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [originalBio, setOriginalBio] = useState('');
  const [originalAvatar, setOriginalAvatar] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameReservationValid, setUsernameReservationValid] = useState<boolean | null>(null);
  
  // Add friend states - moved to AddFriendsModal component
  

  
  // ScrollView ref for auto-scrolling
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll functions
  const scrollToInput = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  // Check if there are any changes made (avatar changes are saved immediately)
  const hasChanges = editName !== originalName || editUsername !== originalUsername || editBio !== originalBio;

  // Username validation effect for edit profile
  useEffect(() => {
    if (!showEditProfile) {
      // Reset states when modal closes
      setIsUsernameAvailable(null);
      setUsernameReservationValid(null);
      return;
    }

    if (editUsername.length < 3 || editUsername === originalUsername) {
      setIsUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsUsernameAvailable(null);
          setIsCheckingUsername(false);
          return;
        }

        // Check if username is available
        const { data, error } = await supabase.rpc('is_username_available', {
          check_username: editUsername.toLowerCase()
        });

        if (error) {
          console.error('Error checking username availability:', error);
          setIsUsernameAvailable(null);
        } else {
          setIsUsernameAvailable(data);
          
          // If available, create/update reservation
          if (data) {
            const { data: reservationSuccess, error: reservationError } = await supabase.rpc('reserve_username', {
              reserve_username: editUsername.toLowerCase(),
              reserve_user_id: user.id
            });

            if (reservationError) {
              console.error('Error creating reservation:', reservationError);
              setUsernameReservationValid(false);
            } else {
              setUsernameReservationValid(reservationSuccess);
            }
          }
        }
      } catch (error) {
        console.error('Error in username validation:', error);
        setIsUsernameAvailable(null);
        setUsernameReservationValid(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editUsername, originalUsername, showEditProfile]);

  // Cleanup reservations when modal closes
  useEffect(() => {
    return () => {
      if (!showEditProfile && usernameReservationValid) {
        // Clean up reservation when modal closes without saving
        const cleanupReservation = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('username_reservations')
                .delete()
                .eq('user_id', user.id);
            }
          } catch (error) {
            console.error('Error cleaning up reservation:', error);
          }
        };
        cleanupReservation();
      }
    };
  }, [showEditProfile, usernameReservationValid]);

  const handleEditProfile = async () => {
    // Check if username was changed and if so, validate reservation
    if (editUsername !== originalUsername) {
      if (!isUsernameAvailable || !usernameReservationValid) {
        Alert.alert('Username Error', 'Please choose a valid available username before saving.');
        return;
      }
    }

    // Update in Supabase via hangStore (avatar is already saved separately)
    const success = await updateUserData({
      name: editName,
      username: editUsername.toLowerCase(),
      vibe: editBio,
    });

    if (success) {
    setUserProfile({
      ...userProfile,
      name: editName,
      bio: editBio,
        avatar: editAvatar,
      });
      
      // Clean up reservation since we successfully saved
      if (editUsername !== originalUsername && usernameReservationValid) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('username_reservations')
              .delete()
              .eq('username', editUsername.toLowerCase())
              .eq('user_id', user.id);
          }
        } catch (error) {
          console.error('Error cleaning up reservation after save:', error);
        }
      }
      
    setShowEditProfile(false);
    } else {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  // Helper function to extract file path from Supabase URL
  const extractPathFromUrl = (url: string): string | null => {
    try {
      // Extract path from Supabase Storage URL
      const urlParts = url.split('/storage/v1/object/public/avatars/');
      return urlParts[1] || null;
    } catch (error) {
      console.error('Error extracting path from URL:', error);
      return null;
    }
  };

  const handleChangeProfilePicture = async () => {
    const processAvatarUpdate = async (avatarUrl: string, oldAvatarUrl?: string) => {
      try {
        // Force cache bust by adding timestamp to the URL that will be saved
        const cacheBustedUrl = `${avatarUrl}?v=${Date.now()}`;
        
        // Save cache-busted URL to database
        const updateSuccess = await updateUserData({
          avatar_url: cacheBustedUrl,
        });
        
        if (updateSuccess) {
          // Update UI state immediately
          setEditAvatar(cacheBustedUrl);
          setUserProfile(prev => ({ ...prev, avatar: cacheBustedUrl }));
          
          // Force reload user data to ensure everything is synced
          await loadUserData();
          
          // Also reload friends to update their view of your avatar
          await loadFriends();
          
          // Delete old avatar if it exists and is not a default avatar
          if (oldAvatarUrl && !oldAvatarUrl.includes('gravatar') && !oldAvatarUrl.includes('default') && !oldAvatarUrl.includes('ui-avatars')) {
            try {
              const oldPath = extractPathFromUrl(oldAvatarUrl);
              if (oldPath) {
                await deleteImage(oldPath);
                console.log('Old avatar deleted successfully');
              }
            } catch (error) {
              console.error('Failed to delete old avatar:', error);
            }
          }
          
          console.log('Avatar saved to database successfully with URL:', cacheBustedUrl);
          Alert.alert('Success!', 'Profile picture updated!');
        } else {
          // Rollback: delete the uploaded image since database update failed
          try {
            const uploadedPath = extractPathFromUrl(avatarUrl);
            if (uploadedPath) {
              await deleteImage(uploadedPath);
              console.log('Uploaded image deleted due to database update failure');
            }
          } catch (deleteError) {
            console.error('Failed to delete uploaded image during rollback:', deleteError);
          }
          Alert.alert('Error', 'Failed to update profile picture. Please try again.');
        }
      } catch (error) {
        console.error('Error in processAvatarUpdate:', error);
        Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      }
    };

    Alert.alert(
      'Change Profile Picture',
      'Choose how you want to update your photo',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Sorry, we need camera permissions to take photos.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              console.log('New avatar selected from camera:', asset.uri);
              
              try {
                setUploadProgress(0);
                const uploadResult = await uploadImage(asset.uri, 'avatars', 'profiles', (p) => setUploadProgress(p));
                const avatarUrl = uploadResult.url;
                console.log('Avatar uploaded successfully:', avatarUrl);
                
                await processAvatarUpdate(avatarUrl, user.avatar);
              } catch (error) {
                console.error('Upload error:', error);
                Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
                return;
              } finally {
                setUploadProgress(null);
              }
            }
          }
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to change your profile picture.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              console.log('New avatar selected from gallery:', asset.uri);
              
              try {
                setUploadProgress(0);
                const uploadResult = await uploadImage(asset.uri, 'avatars', 'profiles', (p) => setUploadProgress(p));
                const avatarUrl = uploadResult.url;
                console.log('Avatar uploaded successfully:', avatarUrl);
                
                await processAvatarUpdate(avatarUrl, user.avatar);
              } catch (error) {
                console.error('Upload error:', error);
                Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
                return;
              } finally {
                setUploadProgress(null);
              }
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Add friend functionality moved to AddFriendsModal component

  const handleFriendTap = (friend: Friend) => {
    setSelectedUserId(friend.id);
    setShowUserProfile(true);
  };

  const handleUnblockUser = async (userId: string) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock', 
          onPress: async () => {
            try {
              await unblockUser(userId);
              // Refresh blocked users list
              await loadAllRelationships();
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to log out');
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

  const sortedFriends = allFriends.sort((a, b) => {
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

  // Handle modal close with confirmation if there are changes
  const handleCloseModal = async () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close without saving?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel'
          },
          {
            text: 'Discard Changes',
            onPress: async () => {
              // Clean up any username reservation
              if (usernameReservationValid) {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    await supabase
                      .from('username_reservations')
                      .delete()
                      .eq('user_id', user.id);
                  }
                } catch (error) {
                  console.error('Error cleaning up reservation:', error);
                }
              }
              
              // Reset to original values (except avatar - it's already saved)
              setEditName(originalName);
              setEditUsername(originalUsername);
              setEditBio(originalBio);
              setIsUsernameAvailable(null);
              setUsernameReservationValid(null);
              setShowEditProfile(false);
            }
          }
        ]
      );
    } else {
      // No changes, just close
      setShowEditProfile(false);
    }
  };

  const handleRequestPress = (request: any) => {
    setSelectedRequest(request);
    setShowRequestProfile(true);
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      console.log('✅ Accepting friend request:', requestId);
      const success = await acceptFriendRequest(requestId);
      if (success) {
        console.log('✅ Friend request accepted successfully');
        setShowRequestProfile(false);
        setSelectedRequest(null);
      } else {
        Alert.alert('Error', 'Failed to accept friend request. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      console.log('❌ Declining friend request:', requestId);
      const success = await declineFriendRequest(requestId);
      if (success) {
        console.log('✅ Friend request declined successfully');
        setShowRequestProfile(false);
        setSelectedRequest(null);
      } else {
        Alert.alert('Error', 'Failed to decline friend request. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceRefresh();
      await loadUserData(); // Also refresh user data
      // Note: hangStore friends are updated via real-time, no need to reload manually
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderRequestItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleRequestPress(item)}
    >
      <Image 
        source={{ uri: item.sender_avatar_url || generateDefaultAvatar(item.sender_name, item.sender_id) }} 
        style={styles.avatar} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.sender_name}</Text>
        <Text style={styles.userUsername}>@{item.sender_username}</Text>
        {item.sender_vibe && <Text style={styles.userVibe} numberOfLines={1}>{item.sender_vibe}</Text>}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity 
          style={styles.acceptQuickButton}
          onPress={() => handleAcceptRequest(item.request_id)}
        >
          <Check size={18} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.declineQuickButton}
          onPress={() => handleDeclineRequest(item.request_id)}
        >
          <X size={18} color={Colors.light.secondaryText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Listen for blocked users changes
  //useEffect(() => {
  //  console.log('Profile: Blocked users state changed:', blockedUsers.length, blockedUsers);
  //}, [blockedUsers]);

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
        <ScrollView 
          style={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.light.primary}
              colors={[Colors.light.primary]}
            />
          }
        >
          {/* Profile Preview Section */}
          <TouchableOpacity 
            style={styles.profilePreview}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: editAvatar || userProfile.avatar }} 
              style={styles.profilePreviewImage} 
              key={editAvatar || userProfile.avatar}
            />
            <View style={styles.profilePreviewInfo}>
              <Text style={styles.profilePreviewName}>{editName || userProfile.name}</Text>
              <Text style={styles.profilePreviewUsername}>@{editUsername}</Text>
              <Text style={styles.profilePreviewBio} numberOfLines={2}>{editBio || "Add a bio to tell friends about yourself"}</Text>
            </View>
            <Edit3 size={20} color={Colors.light.primary} />
          </TouchableOpacity>
          
          {/* Friends Section */}
          <View style={styles.friendsSection}>
            {/* Tab Header */}
            <View style={styles.tabHeader}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
                onPress={() => setActiveTab('friends')}
              >
                <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                  Friends ({allFriends.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
                onPress={() => setActiveTab('requests')}
              >
                <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                  Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addFriendButton}
                onPress={() => setShowAddFriend(true)}
              >
                <UserPlus size={18} color={Colors.light.primary} />
                <Text style={styles.addFriendText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {/* Tab Content */}
            {activeTab === 'friends' ? (
              allFriends.length > 0 ? (
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
              )
            ) : (
              <View style={styles.requestsContent}>
                              {incomingRequests.length > 0 ? (
                <FlatList
                  data={incomingRequests}
                    renderItem={renderRequestItem}
                    keyExtractor={(item) => item.request_id}
                    scrollEnabled={false}
                    contentContainerStyle={styles.requestsList}
                    showsVerticalScrollIndicator={false}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <User size={48} color={Colors.light.secondaryText} />
                    <Text style={styles.emptyStateText}>No friend requests</Text>
                    <Text style={styles.emptyStateSubtext}>When people send you friend requests, they'll appear here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* User Profile Modal */}
      <UserProfileModal 
        visible={showUserProfile}
        userId={selectedUserId}
        onClose={() => setShowUserProfile(false)}
      />

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <X size={24} color={Colors.light.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingContainer}
          >
            <ScrollView 
              ref={scrollViewRef}
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <View style={styles.editForm}>
              {/* Profile Picture */}
              <View style={styles.profilePictureSection}>
                <TouchableOpacity 
                  style={styles.profilePictureContainer}
                  onPress={handleChangeProfilePicture}
                >
                  <Image 
                    source={{ uri: editAvatar }} 
                    style={styles.editProfileImage} 
                    key={editAvatar}
                  />
                  {uploadProgress !== null && (
                    <View style={styles.uploadOverlay}>
                      <Text style={styles.uploadText}>{uploadProgress}%</Text>
                    </View>
                  )}
                  <View style={styles.cameraOverlay}>
                    <Camera size={20} color="white" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.profilePictureText}>Tap image to change</Text>
              </View>
              
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                onFocus={() => scrollToInput(50)}
              />

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={editUsername}
                onChangeText={(text) => {
                  // Allow only alphanumeric characters, dots, underscores, and hyphens (no spaces)
                  const cleanText = text.replace(/[^a-zA-Z0-9._-]/g, '');
                  setEditUsername(cleanText);
                }}
                placeholder="username"
                autoCapitalize="none"
                onFocus={() => scrollToInput(150)}
              />
              {editUsername !== originalUsername && editUsername.length >= 3 && (
                <View style={styles.usernameIndicator}>
                  {isCheckingUsername ? (
                    <Text style={styles.checkingText}>Checking...</Text>
                  ) : isUsernameAvailable === true ? (
                    <Text style={styles.availableText}>Available</Text>
                  ) : isUsernameAvailable === false ? (
                    <Text style={styles.takenText}>Username taken</Text>
                  ) : null}
                </View>
              )}
              
              <Text style={styles.inputLabel}>Ideal hang vibe</Text>
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                value={editBio}
                onChangeText={(text) => text.length <= 100 && setEditBio(text)}
                placeholder="Love it when time doesn't exist and everything just clicks! :)"
                multiline
                maxLength={100}
                onFocus={() => scrollToInput(300)}
              />
              <Text style={styles.characterCount}>{editBio.length}/100</Text>
              
              <TouchableOpacity 
                style={[
                  styles.saveButton, 
                  (editUsername !== originalUsername && (!isUsernameAvailable || !usernameReservationValid)) && styles.disabledButton
                ]} 
                onPress={handleEditProfile}
                disabled={editUsername !== originalUsername && (!isUsernameAvailable || !usernameReservationValid)}
              >
                <Text style={[
                  styles.saveButtonText,
                  (editUsername !== originalUsername && (!isUsernameAvailable || !usernameReservationValid)) && styles.disabledButtonText
                ]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add Friend Modal */}
      <AddFriendsModal 
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
      />

      {/* Friend Request Profile Modal */}
      <Modal
        visible={showRequestProfile}
        animationType="fade"
        transparent={true}
      >
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowRequestProfile(false)}
        >
          <TouchableOpacity 
            style={styles.profileModal}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when clicking inside modal
          >
            {selectedRequest && (
              <>
                {/* Close Button */}
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowRequestProfile(false)}
                >
                  <X size={20} color={Colors.light.secondaryText} />
                </TouchableOpacity>

                {/* Profile Picture */}
                <Image 
                  source={{ uri: selectedRequest.sender_avatar_url || generateDefaultAvatar(selectedRequest.sender_name, selectedRequest.sender_id) }} 
                  style={styles.profileAvatar} 
                />
                
                {/* Name & Username */}
                <Text style={styles.profileName}>{selectedRequest.sender_name}</Text>
                <Text style={styles.profileUsername}>@{selectedRequest.sender_username}</Text>
                
                {/* Vibe */}
                {selectedRequest.sender_vibe && (
                  <Text style={styles.profileVibe}>{selectedRequest.sender_vibe}</Text>
                )}
                
                {/* Action Buttons - side by side */}
                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={styles.modalAcceptButton}
                    onPress={() => handleAcceptRequest(selectedRequest.request_id)}
                    disabled={isLoading}
                  >
                    <Check size={20} color="white" />
                    <Text style={styles.modalAcceptText}>Accept</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.modalDeclineButton}
                    onPress={() => handleDeclineRequest(selectedRequest.request_id)}
                    disabled={isLoading}
                  >
                    <X size={20} color={Colors.light.secondaryText} />
                    <Text style={styles.modalDeclineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
                    <Image 
                      source={{ uri: item.avatar_url || generateDefaultAvatar(item.name, item.id) }} 
                      style={styles.friendAvatar} 
                    />
                    <View style={styles.friendDetails}>
                      <Text style={styles.friendName}>{item.name}</Text>
                      <Text style={styles.friendLastSeen}>@{item.username}</Text>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.buttonBackground,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  usernameIndicator: {
    marginTop: 8,
    marginBottom: 8,
  },
  checkingText: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    fontStyle: 'italic',
  },
  availableText: {
    fontSize: 14,
    color: Colors.light.onlineGreen,
    fontWeight: '600',
  },
  takenText: {
    fontSize: 14,
    color: Colors.light.destructive,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: Colors.light.buttonBackground,
  },
  disabledButtonText: {
    color: Colors.light.secondaryText,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  // Tab styles
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.light.primary + '20',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  tabTextActive: {
    color: Colors.light.primary,
  },
  // Request styles
  requestCard: {
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
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestDetails: {
    flex: 1,
  },
  requestUsername: {
    fontSize: 14,
    color: Colors.light.primary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Request modal styles
  friendDetailBio: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    marginTop: 8,
    lineHeight: 20,
  },
  requestModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingHorizontal: 20,
  },
  acceptRequestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptRequestText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  declineRequestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.buttonBackground,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  declineRequestText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
  // AddFriendsModal style components for requests
  requestsContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  requestsList: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.buttonBackground,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
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
  acceptQuickButton: {
    backgroundColor: Colors.light.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  declineQuickButton: {
    backgroundColor: Colors.light.buttonBackground,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
  },
  // Modal styles from AddFriendsModal
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
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Colors.light.buttonBackground,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: Colors.light.buttonBackground,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileUsername: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  profileVibe: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalAcceptText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalDeclineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.buttonBackground,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalDeclineText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondaryText,
  },
});