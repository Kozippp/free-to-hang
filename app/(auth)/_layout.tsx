import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen
        name="terms-of-service"
        options={{ title: 'Terms of Service', headerShown: true, headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{ title: 'Privacy Policy', headerShown: true, headerBackTitle: 'Back' }}
      />
    </Stack>
  );
} 