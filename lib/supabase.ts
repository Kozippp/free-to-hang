import { createClient } from '@supabase/supabase-js';

// Sinu Supabase projekti andmed
// ⚠️ TURVAHOIATUS: Pane need .env faili või kasuta placeholder'eid
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseAnonKey = 'PLACEHOLDER_ANON_KEY_PANE_SIIA_ÕIGE_VÕTI'; // Asenda õige võtmega lokaalselt

// TEMPORARY: Database setup mode - disable actual Supabase calls
// Set to false after running the SQL setup in Supabase dashboard
const DATABASE_SETUP_MODE = true;

// Create mock Supabase client for setup mode
const createMockClient = () => ({
  from: (table: string) => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
  }),
  auth: {
    signUp: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  // Add other methods as needed
});

export const supabase = DATABASE_SETUP_MODE 
  ? createMockClient() as any
  : createClient(supabaseUrl, supabaseAnonKey);

// Database tüübid (automaatselt genereeritakse Supabase CLI-ga)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string;
          bio?: string;
          username: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          avatar_url?: string;
          bio?: string;
          username: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string;
          bio?: string;
          username?: string;
          updated_at?: string;
        };
      };
      friends: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          share_availability: 'never' | 'today' | 'week' | 'forever';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          share_availability?: 'never' | 'today' | 'week' | 'forever';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'blocked';
          share_availability?: 'never' | 'today' | 'week' | 'forever';
        };
      };
      plans: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description?: string;
          location?: string;
          date: string;
          is_anonymous: boolean;
          max_participants?: number;
          status: 'active' | 'completed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description?: string;
          location?: string;
          date: string;
          is_anonymous?: boolean;
          max_participants?: number;
          status?: 'active' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          location?: string;
          date?: string;
          max_participants?: number;
          status?: 'active' | 'completed' | 'cancelled';
          updated_at?: string;
        };
      };
      plan_participants: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          response: 'accepted' | 'maybe' | 'declined' | 'pending';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          response?: 'accepted' | 'maybe' | 'declined' | 'pending';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          response?: 'accepted' | 'maybe' | 'declined' | 'pending';
          updated_at?: string;
        };
      };
    };
  };
}; 