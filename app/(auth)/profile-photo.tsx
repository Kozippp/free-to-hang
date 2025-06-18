import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Camera, Image as ImageIcon, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';

export default function ProfilePhotoScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name, username, vibe } = useLocalSearchParams<{ 
    name: string; 
    username: string; 
    vibe: string; 
  }>();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera roll permissions to let you select photos.');
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera permissions to let you take photos.');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const chooseFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Here you would upload the profile image and save all user data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message and navigate to main app
      Alert.alert(
        'Welcome to Free to Hang! 🎉',
        'Your account has been created successfully. You can now connect with friends and see when they\'re available to hang out!',
        [
          {
            text: 'Get Started',
            onPress: () => router.replace('/(tabs)'),
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    handleContinue();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <View style={styles.logoCircles}>
                <View style={styles.logoCircle1} />
                <View style={styles.logoCircle2} />
                <View style={styles.logoCircle3} />
              </View>
            </View>
            <Text style={styles.logoText}>freetohang</Text>
          </View>

          <View style={styles.mainContent}>
            <Text style={styles.title}>add a profile photo</Text>
            <Text style={styles.subtitle}>
              help your friends recognize you
            </Text>

            {/* Profile Image */}
            <View style={styles.profileImageContainer}>
              <TouchableOpacity 
                style={styles.profileImageWrapper}
                onPress={profileImage ? chooseFromGallery : undefined}
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.placeholderImage}>
                    <User size={60} color="#999" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={takePhoto}>
                <Camera size={20} color={Colors.light.primary} />
                <Text style={styles.primaryButtonText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={chooseFromGallery}>
                <ImageIcon size={20} color={Colors.light.primary} />
                <Text style={styles.primaryButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* Continue/Skip Button */}
            <TouchableOpacity 
              style={[styles.continueButton, isLoading && styles.disabledButton]}
              onPress={handleSkip}
              disabled={isLoading}
            >
              <Text style={[styles.continueButtonText, isLoading && styles.disabledButtonText]}>
                {isLoading ? 'setting up...' : profileImage ? 'continue' : 'skip for now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 60,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  logoCircles: {
    width: 60,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: -8,
  },
  logoCircle1: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
  },
  logoCircle2: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '80',
  },
  logoCircle3: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '40',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 48,
    fontWeight: '400',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#F8F8F8',
    borderWidth: 3,
    borderColor: '#F0F0F0',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 48,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  primaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
}); 