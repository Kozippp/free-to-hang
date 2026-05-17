import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'onboarding_cache_v1_';

export type OnboardingCacheEntry = {
  onboardingCompleted: boolean;
  name: string | null;
  username: string | null;
  cachedAt: string;
};

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

export async function readOnboardingCache(
  userId: string
): Promise<OnboardingCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingCacheEntry;
  } catch {
    return null;
  }
}

export async function writeOnboardingCache(
  userId: string,
  entry: Omit<OnboardingCacheEntry, 'cachedAt'>
): Promise<void> {
  try {
    const payload: OnboardingCacheEntry = {
      ...entry,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    // Non-critical
  }
}

export async function clearOnboardingCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(userId));
  } catch {
    // Non-critical
  }
}
