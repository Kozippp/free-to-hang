import React, { useState, useRef, useEffect } from 'react';
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
import { ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function NameInputScreen() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // Auto focus input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
        pathname: '/(onboarding)/step-2',
        params: { name: name.trim() }
      });
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header with Logo and Back */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.logoText}>freetohang</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>What's your name?</Text>

            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
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
            </View>

            {/* Continue button - positioned above keyboard */}
            {name.trim().length >= 2 && (
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
                  {isLoading ? 'continuing...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            )}
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
  placeholder: {
    width: 40,
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
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
    height: 60,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 32,
    color: Colors.light.text,
    textAlign: 'center',
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
    marginTop: 20,
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