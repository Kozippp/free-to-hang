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
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';

export default function NameInputScreen() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue');
      return;
    }

    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter a valid name');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would save the name to your backend/context
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push({
        pathname: '/(auth)/username-input',
        params: { name: name.trim() }
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
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <View style={styles.logoToggle}>
                <View style={styles.logoKnob} />
              </View>
            </View>
            <Text style={styles.logoText}>Free2Hang</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>what's your name?</Text>
            <Text style={styles.subtitle}>let's get to know each other</Text>

            <TextInput
              style={styles.nameInput}
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={50}
            />

            <TouchableOpacity 
              style={[
                styles.nextButton,
                (!name.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleContinue}
              disabled={!name.trim() || isLoading}
            >
              <Text style={[
                styles.nextButtonText,
                (!name.trim() || isLoading) && styles.disabledButtonText
              ]}>
                {isLoading ? 'continuing...' : 'next'}
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
    width: 60,
    height: 60,
    backgroundColor: Colors.light.primary,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoToggle: {
    width: 40,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  logoKnob: {
    width: 16,
    height: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: 'center',
    marginBottom: 48,
  },
  nameInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 18,
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  nextButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 50,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
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
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
}); 