import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Support multiple Supabase projects with a simple switch via env
// EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT selects which set to use, e.g. "KOZIPPP" or "EBPW"
const ACTIVE = (process.env.EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();

type ProjectKey = 'KOZIPPP' | 'EBPW' | string;

const projectConfigs: Record<ProjectKey, { url?: string | undefined; anon?: string | undefined }> = {
  KOZIPPP: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL_KOZIPPP || process.env.EXPO_PUBLIC_SUPABASE_URL,
    anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_KOZIPPP || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  EBPW: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL_EBPW,
    anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_EBPW,
  },
};

const selected = projectConfigs[ACTIVE] || {};
const supabaseUrl = selected.url;
const supabaseAnonKey = selected.anon;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast for misconfiguration
  throw new Error(
    `Missing Supabase configuration for project "${ACTIVE}". Ensure EXPO_PUBLIC_SUPABASE_URL_* and EXPO_PUBLIC_SUPABASE_ANON_KEY_* are set.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_ACTIVE_PROJECT = ACTIVE;
export const SUPABASE_URL = supabaseUrl;