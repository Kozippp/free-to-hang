import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@freetohang/pending_invite_ref';

/** Persist invite path segment (username or user id) until after sign-in / onboarding. */
export async function setPendingInviteRef(ref: string): Promise<void> {
  const trimmed = ref.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
}

export async function getPendingInviteRef(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function clearPendingInviteRef(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
