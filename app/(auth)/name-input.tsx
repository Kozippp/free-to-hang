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
            <Text style={styles.title}>what's your name?</Text>
            <Text style={styles.subtitle}>let's get to know each other</Text>

            <TextInput
              style={styles.nameInput}
              placeholder="Enter your name"
              placeholderTextColor="#999"
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
    fontWeight: '400',
  },
  nameInput: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 56,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 24,
    color: Colors.light.text,
    marginBottom: 48,
    fontWeight: '400',
  },
  nextButton: {
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
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
}); 