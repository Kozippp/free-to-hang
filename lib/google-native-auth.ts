import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { AccessTokenRequest, AuthRequest, ResponseType } from 'expo-auth-session';
import { discovery } from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/**
 * Google Cloud "Web application" OAuth clients reject custom scheme redirects (e.g. freetohang://).
 * Native PKCE flow uses iOS/Android OAuth client IDs plus Google's reversed-client redirect URI.
 * @see https://developers.google.com/identity/protocols/oauth2/native-app
 */
function googleNativeRedirectUri(clientId: string): string {
  const trimmed = clientId.trim();
  if (!trimmed.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    throw new Error('Invalid Google OAuth client ID format (expected *.apps.googleusercontent.com).');
  }
  const prefix = trimmed.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  return `com.googleusercontent.apps.${prefix}:/oauth2redirect/google`;
}

function getPlatformGoogleClientId(): string {
  if (Platform.OS === 'ios') {
    const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
    if (!id) {
      throw new Error(
        'Google Sign-In is not configured: set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (Google Cloud OAuth ' +
          'client type **iOS**, bundle ID com.freetohang.app). After env or app.config.js changes, create a new dev/production build.'
      );
    }
    return id;
  }
  if (Platform.OS === 'android') {
    const id = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
    if (!id) {
      throw new Error(
        'Google Sign-In is not configured: set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (Google Cloud OAuth ' +
          'client type **Android**, package com.freetohang.app + SHA-1). After env or app.config.js changes, create a new dev/production build.'
      );
    }
    return id;
  }
  throw new Error('Google Sign-In is only available on the iOS and Android apps.');
}

export type GoogleNativeAuthResult =
  | { cancelled: true }
  | { cancelled: false; idToken: string; accessToken?: string };

/**
 * Native Google OAuth (PKCE code flow) → ID token for Supabase `signInWithIdToken`.
 */
export async function signInWithGoogleNative(): Promise<GoogleNativeAuthResult> {
  const clientId = getPlatformGoogleClientId();
  const redirectUri = googleNativeRedirectUri(clientId);

  const request = new AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    responseType: ResponseType.Code,
    usePKCE: true,
  });

  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery, {
    windowFeatures: { width: 515, height: 680 },
  });

  if (result.type !== 'success') {
    return { cancelled: true };
  }

  const code = result.params.code;
  if (!code) {
    throw new Error('Google sign-in did not return an authorization code.');
  }

  const tokenResponse = await new AccessTokenRequest({
    clientId,
    redirectUri,
    scopes: SCOPES,
    code,
    extraParams: {
      code_verifier: request.codeVerifier || '',
    },
  }).performAsync(discovery);

  const idToken = tokenResponse.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token.');
  }

  return {
    cancelled: false,
    idToken,
    accessToken: tokenResponse.accessToken,
  };
}
