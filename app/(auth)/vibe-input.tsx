import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';

export default function VibeInputScreen() {
  const [vibe, setVibe] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name, username } = useLocalSearchParams<{ name: string; username: string }>();

  const handleContinue = async () => {
    if (!vibe.trim()) {
      Alert.alert('Vibe Required', 'Please describe your favorite vibe for hanging out');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would save the vibe to your backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push({
        pathname: '/(auth)/profile-photo',
        params: { name, username, vibe: vibe.trim() }
      });
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push({
      pathname: '/(auth)/profile-photo',
      params: { name, username, vibe: '' }
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
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

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>tell us about yourself</Text>
            <Text style={styles.subtitle}>
              a short bio to help other travelers get to know you (optional)
            </Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.vibeInput}
                placeholder="I'm a foodie who loves exploring local cuisines and meeting new people..."
                placeholderTextColor="#999"
                value={vibe}
                onChangeText={setVibe}
                multiline
                numberOfLines={6}
                maxLength={200}
                textAlignVertical="top"
                autoCorrect={true}
              />
              
              <View style={styles.characterCounter}>
                <Text style={styles.characterCountText}>
                  {vibe.length}/200
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>
                {isLoading ? 'saving...' : 'skip'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 80,
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
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'left',
    marginBottom: 48,
    lineHeight: 22,
    fontWeight: '400',
  },
  inputContainer: {
    marginBottom: 48,
  },
  vibeInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    fontWeight: '400',
    lineHeight: 22,
  },
  characterCounter: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    fontWeight: '400',
  },
  skipButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 28,
    height: 56,
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
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 