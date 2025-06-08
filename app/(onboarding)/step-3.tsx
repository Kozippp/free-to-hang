import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';

export default function VibeSelectionScreen() {
  const [vibe, setVibe] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { name, username } = useLocalSearchParams<{ name: string; username: string }>();

  const handleContinue = async () => {
    if (!vibe.trim()) {
      Alert.alert('Vibe Required', 'Please describe your ideal hang vibe');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would save the vibe to your backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push({
        pathname: '/(onboarding)/step-4',
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
      pathname: '/(onboarding)/step-4',
      params: { name, username, vibe: '' }
    });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {/* Header with Logo and Skip */}
            <View style={styles.header}>
              <Text style={styles.logoText}>freetohang</Text>
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>skip</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>what's your ideal hang vibe?</Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.vibeInput}
                  placeholder="Slow, cozy nights with soft music and meaningful conversations :)"
                  placeholderTextColor="#999"
                  value={vibe}
                  onChangeText={setVibe}
                  multiline
                  numberOfLines={4}
                  maxLength={100}
                  textAlignVertical="top"
                  autoCorrect={true}
                />
                
                <View style={styles.characterCounter}>
                  <Text style={styles.characterCountText}>
                    {vibe.length}/100
                  </Text>
                </View>
              </View>

              {/* Submit button - shows above keyboard when typing */}
              {vibe.trim().length > 0 && (
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
                    {isLoading ? 'saving...' : 'continue'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '400',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 32,
    textAlign: 'left',
    lineHeight: 34,
  },
  inputContainer: {
    marginBottom: 24,
  },
  vibeInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
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
  continueButton: {
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
    marginTop: 16,
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