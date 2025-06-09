import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  
  // Cache duration settings (in milliseconds)
  private readonly CACHE_DURATIONS = {
    USER_PROFILE: 5 * 60 * 1000,      // 5 minutes
    FRIENDS_LIST: 2 * 60 * 1000,      // 2 minutes  
    FRIEND_REQUESTS: 1 * 60 * 1000,   // 1 minute
    SEARCH_RESULTS: 30 * 1000,        // 30 seconds
    PLANS: 1 * 60 * 1000,             // 1 minute
    USER_STATUS: 30 * 1000,           // 30 seconds
  };
  
  private constructor() {
    // Clean expired cache every 5 minutes
    setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);
  }
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  // Get from cache (memory first, then AsyncStorage)
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && !this.isExpired(memoryItem)) {
      console.log(`Cache HIT (memory): ${key}`);
      return memoryItem.data;
    }
    
    // Check persistent cache
    try {
      const stored = await AsyncStorage.getItem(`cache_${key}`);
      if (stored) {
        const item: CacheItem<T> = JSON.parse(stored);
        if (!this.isExpired(item)) {
          // Store back in memory for faster access
          this.memoryCache.set(key, item);
          console.log(`Cache HIT (storage): ${key}`);
          return item.data;
        } else {
          // Remove expired item
          await AsyncStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    
    console.log(`Cache MISS: ${key}`);
    return null;
  }
  
  // Set cache (both memory and AsyncStorage)
  async set<T>(key: string, data: T, cacheType: keyof typeof this.CACHE_DURATIONS): Promise<void> {
    const expiresIn = this.CACHE_DURATIONS[cacheType];
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn
    };
    
    // Store in memory
    this.memoryCache.set(key, item);
    
    // Store persistently (don't wait for it)
    AsyncStorage.setItem(`cache_${key}`, JSON.stringify(item)).catch(error => {
      console.error('Cache write error:', error);
    });
    
    console.log(`Cache SET: ${key} (expires in ${expiresIn}ms)`);
  }
  
  // Generate cache keys
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}_${parts.join('_')}`;
  }
  
  // Invalidate specific cache
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await AsyncStorage.removeItem(`cache_${key}`);
    console.log(`Cache INVALIDATED: ${key}`);
  }
  
  // Invalidate cache by prefix
  async invalidateByPrefix(prefix: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clear AsyncStorage cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const prefixedKeys = keys.filter(key => key.startsWith(`cache_${prefix}`));
      await AsyncStorage.multiRemove(prefixedKeys);
      console.log(`Cache INVALIDATED by prefix: ${prefix} (${prefixedKeys.length} items)`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  // Check if cache item is expired
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.expiresIn;
  }
  
  // Clean expired items from memory cache
  private cleanExpiredCache(): void {
    let cleaned = 0;
    for (const [key, item] of this.memoryCache.entries()) {
      if (this.isExpired(item)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache items`);
    }
  }
  
  // Get cache statistics
  getCacheStats(): { memoryItems: number; memorySize: number } {
    return {
      memoryItems: this.memoryCache.size,
      memorySize: JSON.stringify([...this.memoryCache.entries()]).length
    };
  }
  
  // Clear all cache
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`Cleared all cache (${cacheKeys.length} items)`);
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }
}

export const cacheManager = CacheManager.getInstance();

// Helper function for cache-aware data fetching
export async function cachedFetch<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  cacheType: 'USER_PROFILE' | 'FRIENDS_LIST' | 'FRIEND_REQUESTS' | 'SEARCH_RESULTS' | 'PLANS' | 'USER_STATUS'
): Promise<T> {
  const cache = CacheManager.getInstance();
  
  // Try to get from cache first
  const cached = await cache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch from source and cache
  const data = await fetchFunction();
  await cache.set(cacheKey, data, cacheType);
  
  return data;
} 