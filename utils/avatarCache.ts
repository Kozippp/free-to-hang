import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const CACHE_DIR = `${FileSystem.cacheDirectory}avatar-cache/`;
const INDEX_KEY = 'avatar_cache_index_v1';
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_AGE_DAYS = 90;
const STALE_REFRESH_DAYS = 7;

type AvatarCacheEntry = {
  userId: string;
  url: string;
  localUri: string;
  lastAccessed: number;
  lastValidated: number;
  size: number;
};

let indexCache: Record<string, AvatarCacheEntry> | null = null;
let pendingSave: ReturnType<typeof setTimeout> | null = null;

const dayMs = 24 * 60 * 60 * 1000;

const hashString = (input: string) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const getFileExtension = (url: string) => {
  const cleanUrl = url.split('?')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase();
  if (!ext || ext.length > 5) return 'jpg';
  return ext;
};

const buildLocalUri = (userId: string, url: string) => {
  const ext = getFileExtension(url);
  const hash = hashString(url);
  return `${CACHE_DIR}${userId}_${hash}.${ext}`;
};

const ensureCacheDir = async () => {
  if (!FileSystem.cacheDirectory) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

const loadIndex = async () => {
  if (indexCache) return indexCache;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    indexCache = raw ? (JSON.parse(raw) as Record<string, AvatarCacheEntry>) : {};
  } catch (error) {
    console.warn('⚠️ Failed to load avatar cache index:', error);
    indexCache = {};
  }
  return indexCache;
};

const scheduleIndexSave = (index: Record<string, AvatarCacheEntry>) => {
  indexCache = index;
  if (pendingSave) {
    clearTimeout(pendingSave);
  }
  pendingSave = setTimeout(() => {
    AsyncStorage.setItem(INDEX_KEY, JSON.stringify(indexCache)).catch((error) => {
      console.warn('⚠️ Failed to save avatar cache index:', error);
    });
    pendingSave = null;
  }, 500);
};

const isEntryStale = (entry: AvatarCacheEntry, refreshDays: number) => {
  if (refreshDays <= 0) return false;
  return Date.now() - entry.lastValidated > refreshDays * dayMs;
};

const refreshEntry = async (
  entry: AvatarCacheEntry,
  url: string,
  index: Record<string, AvatarCacheEntry>
) => {
  const localUri = buildLocalUri(entry.userId, url);
  try {
    if (entry.localUri && entry.localUri !== localUri) {
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    }
    const download = await FileSystem.downloadAsync(url, localUri);
    const info = await FileSystem.getInfoAsync(download.uri, { size: true });
    const updatedEntry: AvatarCacheEntry = {
      userId: entry.userId,
      url,
      localUri: download.uri,
      lastAccessed: Date.now(),
      lastValidated: Date.now(),
      size: info.size ?? entry.size ?? 0
    };
    index[entry.userId] = updatedEntry;
    scheduleIndexSave(index);
    return updatedEntry.localUri;
  } catch (error) {
    console.warn('⚠️ Avatar refresh failed, using cached file:', error);
    return entry.localUri;
  }
};

export const getCachedAvatarUri = async (
  userId: string,
  url?: string | null,
  options?: { refreshIfOlderThanDays?: number }
) => {
  if (!userId || !url) return null;
  await ensureCacheDir();
  const index = await loadIndex();
  const existing = index[userId];
  const refreshDays = options?.refreshIfOlderThanDays ?? STALE_REFRESH_DAYS;

  if (existing && existing.url === url) {
    const info = await FileSystem.getInfoAsync(existing.localUri);
    if (info.exists) {
      const updatedEntry: AvatarCacheEntry = {
        ...existing,
        lastAccessed: Date.now(),
        size: existing.size || 0
      };
      index[userId] = updatedEntry;
      scheduleIndexSave(index);

      if (isEntryStale(existing, refreshDays)) {
        return refreshEntry(existing, url, index);
      }
      return existing.localUri;
    }
  }

  const entry: AvatarCacheEntry = existing || {
    userId,
    url,
    localUri: buildLocalUri(userId, url),
    lastAccessed: Date.now(),
    lastValidated: 0,
    size: 0
  };

  return refreshEntry(entry, url, index);
};

export const prefetchAvatars = async (
  avatars: Array<{ userId: string; avatarUrl?: string | null }>
) => {
  if (!avatars.length) return;
  for (const { userId, avatarUrl } of avatars) {
    if (!userId || !avatarUrl) continue;
    await getCachedAvatarUri(userId, avatarUrl).catch(() => null);
  }
};

export const pruneAvatarCache = async () => {
  await ensureCacheDir();
  const index = await loadIndex();
  const now = Date.now();
  const entries = Object.values(index);
  let totalSize = 0;

  for (const entry of entries) {
    const info = await FileSystem.getInfoAsync(entry.localUri);
    if (!info.exists) {
      delete index[entry.userId];
      continue;
    }
    const size = info.size ?? entry.size ?? 0;
    entry.size = size;
    index[entry.userId] = entry;
    totalSize += size;
  }

  const maxAgeMs = MAX_AGE_DAYS * dayMs;
  const staleEntries = entries.filter((entry) => now - entry.lastAccessed > maxAgeMs);
  for (const entry of staleEntries) {
    await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    delete index[entry.userId];
    totalSize -= entry.size || 0;
  }

  if (totalSize > MAX_CACHE_BYTES) {
    const sorted = Object.values(index).sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const entry of sorted) {
      if (totalSize <= MAX_CACHE_BYTES) break;
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
      delete index[entry.userId];
      totalSize -= entry.size || 0;
    }
  }

  scheduleIndexSave(index);
};

export const useCachedAvatar = (
  userId?: string | null,
  url?: string | null,
  options?: { refreshIfOlderThanDays?: number }
) => {
  const [resolvedUri, setResolvedUri] = useState<string | null>(url ?? null);

  useEffect(() => {
    let active = true;
    if (!userId || !url) {
      setResolvedUri(url ?? null);
      return;
    }

    getCachedAvatarUri(userId, url, options)
      .then((cached) => {
        if (active) setResolvedUri(cached ?? url);
      })
      .catch(() => {
        if (active) setResolvedUri(url ?? null);
      });

    return () => {
      active = false;
    };
  }, [userId, url, options?.refreshIfOlderThanDays]);

  return resolvedUri;
};
