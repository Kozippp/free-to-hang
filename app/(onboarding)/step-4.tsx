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
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function ProfilePhotoScreen() {
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name, username, vibe } = useLocalSearchParams<{ 
    name: string; 
    username: string; 
    vibe: string; 
  }>();

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission',
        'We need photo library permission to select images.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const showImagePicker = () => {
    Alert.alert(
      'Add Profile Photo',
      'Choose how you\'d like to add your photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Here you would save the profile data to your backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to main app first
      router.replace('/(tabs)');
      
      // Then show congrats message after a brief delay
      setTimeout(() => {
        Alert.alert(
          'Welcome to Free to Hang! 🎉',
          'Now connect with your friends and make plans effortlessly',
          [
            {
              text: 'Get Started',
              style: 'default'
            }
          ]
        );
      }, 500);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    handleContinue();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header with Logo, Back and Skip */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.logoText}>freetohang</Text>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Add a profile photo</Text>
          
          <View style={styles.photoContainer}>
            {profilePhoto ? (
              <TouchableOpacity onPress={showImagePicker} style={styles.photoWrapper}>
                <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
                <View style={styles.editOverlay}>
                  <ImageIcon size={24} color="white" />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={showImagePicker} style={styles.addPhotoButton}>
                <Camera size={32} color={Colors.light.primary} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.subtitle}>
            Help your friends recognize you by adding a profile photo
          </Text>

          {/* Continue button - only show when photo is selected */}
          {profilePhoto && (
            <TouchableOpacity 
              style={[
                styles.continueButton,
                isLoading && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={isLoading}
            >
              <Text style={[
                styles.continueButtonText,
                isLoading && styles.disabledButtonText
              ]}>
                {isLoading ? 'Finishing up...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '400',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 60,
    textAlign: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  addPhotoButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  addPhotoText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  photoWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  editOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 60,
    paddingHorizontal: 16,
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