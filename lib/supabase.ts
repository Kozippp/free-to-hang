import { createClient } from '@supabase/supabase-js';

// Sinu Supabase projekti andmed
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5memJ2dXludHpnc3pxZGxzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzU3ODYsImV4cCI6MjA2NDUxMTc4Nn0.YJyRcqm6e-0VfOhQuAQr4sPi3cZCwdvkmwxormMb7_0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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