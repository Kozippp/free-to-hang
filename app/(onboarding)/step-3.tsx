import React, { useState, useRef, useEffect } from 'react';
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
import { ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function VibeInputScreen() {
  const [vibe, setVibe] = useState('');
  const router = useRouter();
  const { name, username } = useLocalSearchParams<{ name: string; username: string }>();
  const inputRef = useRef<TextInput>(null);

  // Auto focus input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    router.push({
      pathname: '/(onboarding)/step-4',
      params: { name, username, vibe }
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/(onboarding)/step-4',
      params: { name, username, vibe: '' }
    });
  };

  const handleBack = () => {
    router.back();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
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
              <Text style={styles.title}>what's your ideal hang vibe?</Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={styles.vibeInput}
                  value={vibe}
                  onChangeText={setVibe}
                  placeholder="Slow, cozy nights with soft music and meaningful conversations :)"
                  placeholderTextColor="#999"
                  multiline
                  textAlignVertical="top"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  maxLength={100}
                />
                <Text style={styles.characterCount}>{vibe.length}/100</Text>
              </View>

              {/* Continue button - positioned above keyboard */}
              <TouchableOpacity 
                style={[
                  styles.continueButton,
                  vibe.trim() ? styles.continueButtonActive : styles.continueButtonInactive
                ]}
                onPress={handleContinue}
              >
                <Text style={[
                  styles.continueButtonText,
                  vibe.trim() ? styles.continueButtonTextActive : styles.continueButtonTextInactive
                ]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
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
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 60,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  vibeInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  continueButton: {
    borderRadius: 28,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  continueButtonActive: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonInactive: {
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButtonTextActive: {
    color: 'white',
  },
  continueButtonTextInactive: {
    color: '#999',
  },
}); 