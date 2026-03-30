import * as WebBrowser from 'expo-web-browser';
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

/**
 * PKCE + in-app browser flow must use a **Web application** OAuth client ID.
 * That client is where Google allows registering `freetohang://oauthredirect`.
 * iOS/Android OAuth client types do not accept this redirect → Error 400 invalid_request.
 */
function getGoogleWebClientIdForAuthSession(): string {
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (web) return web;

  throw new Error(
    'Google Sign-In is not configured: set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your Google Cloud ' +
      '"Web application" OAuth client ID, and add authorized redirect URI exactly: freetohang://oauthredirect. ' +
      '(Do not use the iOS/Android-only client ID for this flow.)'
  );
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
  const clientId = getGoogleWebClientIdForAuthSession();
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
