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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>What's Your Favorite Vibe for Hanging Out?</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.vibeInput}
                placeholder="Describe your perfect hangout vibe..."
                placeholderTextColor="#999"
                value={vibe}
                onChangeText={setVibe}
                multiline
                numberOfLines={4}
                maxLength={120}
                textAlignVertical="top"
                autoCorrect={true}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              
              <View style={styles.characterCounter}>
                <Text style={styles.characterCountText}>
                  {vibe.length}/120
                </Text>
                             </View>
             </View>

            <TouchableOpacity 
              style={[
                styles.continueButton,
                (!vibe.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={!vibe.trim() || isLoading}
            >
              <Text style={[
                styles.continueButtonText,
                (!vibe.trim() || isLoading) && styles.disabledButtonText
              ]}>
                {isLoading ? 'saving...' : 'continue'}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 36,
  },
  inputContainer: {
    marginBottom: 32,
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
  },
  characterCounter: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: Colors.light.secondaryText,
  },
  continueButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
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