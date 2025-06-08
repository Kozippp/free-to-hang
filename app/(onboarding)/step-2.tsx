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
import { Stack, useRouter } from 'expo-router';
import { Camera, Upload, User, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';

export default function OnboardingStep2Screen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const router = useRouter();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Sorry, we need camera roll permissions to make this work!'
      );
      return false;
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Sorry, we need camera permissions to take a photo!'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleContinue = () => {
    // Save profile image
    // For now, just navigate to next step
    router.push('/(onboarding)/step-3');
  };

  const handleSkip = () => {
    router.push('/(onboarding)/step-3');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header with progress and navigation */}
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={Colors.light.secondaryText} />
          </TouchableOpacity>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.completedStep]} />
              <View style={[styles.progressStep, styles.activeStep]} />
              <View style={styles.progressStep} />
            </View>
          </View>
          
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>add a profile photo</Text>
          <Text style={styles.subtitle}>
            help others recognize you when meeting up (optional)
          </Text>

          {/* Profile image preview */}
          <View style={styles.imageContainer}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <User size={60} color={Colors.light.secondaryText} />
              </View>
            )}
          </View>

          {/* Photo options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.primaryOption} onPress={takePhoto}>
              <View style={styles.optionIconContainer}>
                <Camera size={20} color="white" />
              </View>
              <Text style={styles.primaryOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryOption} onPress={pickImageFromGallery}>
              <View style={styles.secondaryIconContainer}>
                <Upload size={20} color={Colors.light.primary} />
              </View>
              <Text style={styles.secondaryOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {selectedImage && (
            <TouchableOpacity 
              style={styles.removeButton} 
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeText}>Remove Photo</Text>
            </TouchableOpacity>
          )}

          {/* Continue button */}
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              continue
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 40,
    marginBottom: 30,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    maxWidth: 120,
  },
  progressStep: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  activeStep: {
    backgroundColor: Colors.light.primary,
  },
  completedStep: {
    backgroundColor: Colors.light.primary,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 50,
    lineHeight: 22,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.buttonBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  primaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    gap: 12,
  },
  optionIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryOptionText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    gap: 12,
  },
  secondaryIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryOptionText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  removeButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  removeText: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textDecorationLine: 'underline',
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 32,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
}); 