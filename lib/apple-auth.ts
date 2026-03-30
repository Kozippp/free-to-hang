import * as Crypto from 'expo-crypto';

const NONCE_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

/** Cryptographically random nonce for Apple Sign-In + Supabase `signInWithIdToken`. */
export async function createAppleAuthNonce(byteLength = 32): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  let result = '';
  for (let i = 0; i < byteLength; i++) {
    result += NONCE_CHARSET.charAt(bytes[i]! % NONCE_CHARSET.length);
  }
  return result;
}
