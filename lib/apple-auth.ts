const NONCE_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

function getRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
    return bytes;
  }
  throw new Error(
    'Secure random is unavailable. Import react-native-get-random-values at the app entry (see app/_layout.tsx).'
  );
}

/** Cryptographically random nonce for Apple Sign-In + Supabase `signInWithIdToken`. */
export async function createAppleAuthNonce(byteLength = 32): Promise<string> {
  const bytes = getRandomBytes(byteLength);
  let result = '';
  for (let i = 0; i < byteLength; i++) {
    result += NONCE_CHARSET.charAt(bytes[i]! % NONCE_CHARSET.length);
  }
  return result;
}
