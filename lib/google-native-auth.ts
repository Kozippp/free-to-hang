import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import {
  AccessTokenRequest,
  AuthRequest,
  makeRedirectUri,
  ResponseType,
} from 'expo-auth-session';
import { discovery } from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getPlatformGoogleClientId(): string {
  if (Platform.OS === 'ios') {
    const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!id?.trim()) {
      throw new Error(
        'Google Sign-In is not configured: set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in your environment.'
      );
    }
    return id.trim();
  }
  if (Platform.OS === 'android') {
    const id = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    if (!id?.trim()) {
      throw new Error(
        'Google Sign-In is not configured: set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your environment.'
      );
    }
    return id.trim();
  }
  throw new Error('Google Sign-In is only available on the iOS and Android apps.');
}

/**
 * OAuth redirect must match app.json `scheme` (see ios Info.plist / Android intent-filters).
 * Register this exact URI under your Google Cloud OAuth client (Web client → Authorized redirect URIs).
 */
function getRedirectUri(): string {
  return makeRedirectUri({
    scheme: 'freetohang',
    path: 'oauthredirect',
  });
}

export type GoogleNativeAuthResult =
  | { cancelled: true }
  | { cancelled: false; idToken: string; accessToken?: string };

/**
 * Native Google OAuth (PKCE code flow) → ID token for Supabase `signInWithIdToken`.
 */
export async function signInWithGoogleNative(): Promise<GoogleNativeAuthResult> {
  const clientId = getPlatformGoogleClientId();
  const redirectUri = getRedirectUri();

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
