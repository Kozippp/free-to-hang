-- Kasutajate tabel
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Sõprade tabel
CREATE TABLE friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  share_availability TEXT CHECK (share_availability IN ('never', 'today', 'week', 'forever')) DEFAULT 'week',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Plaanide tabel
CREATE TABLE plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  max_participants INTEGER,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plaani osalejate tabel
CREATE TABLE plan_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  response TEXT CHECK (response IN ('accepted', 'maybe', 'declined', 'pending')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, user_id)
);

-- Kasutaja staatuse tabel (online/offline/available)
CREATE TABLE user_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  is_available BOOLEAN DEFAULT FALSE,
  activity TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) policies

-- Users tabel
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Friends tabel
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their friends" 
ON friends FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can manage their friendships" 
ON friends FOR ALL 
USING (auth.uid() = user_id);

-- Plans tabel
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plans they're involved in" 
ON plans FOR SELECT 
USING (
  auth.uid() = creator_id OR 
  auth.uid() IN (
    SELECT user_id FROM plan_participants WHERE plan_id = plans.id
  )
);

CREATE POLICY "Users can create plans" 
ON plans FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Plan creators can update their plans" 
ON plans FOR UPDATE 
USING (auth.uid() = creator_id);

-- Plan participants tabel
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plan participants" 
ON plan_participants FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (
    SELECT creator_id FROM plans WHERE id = plan_id
  )
);

CREATE POLICY "Users can manage their participation" 
ON plan_participants FOR ALL 
USING (auth.uid() = user_id);

-- User status tabel
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view friends' status" 
ON user_status FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (
    SELECT friend_id FROM friends 
    WHERE user_id = user_status.user_id AND status = 'accepted'
  )
);

CREATE POLICY "Users can update their own status" 
ON user_status FOR ALL 
USING (auth.uid() = user_id);

-- Funktsioonid ja triggerid

-- Funktsioon kasutaja loomiseks peale registreerumist
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_status (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger uue kasutaja loomisel
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Funktsioon updated_at välja automaatseks uuendamiseks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggerid updated_at välja jaoks
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_participants_updated_at BEFORE UPDATE ON plan_participants 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_status_updated_at BEFORE UPDATE ON user_status 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column(); 

-- ============================================
-- Notification system tables
-- ============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN (
    'plan_invite',
    'plan_update', 
    'plan_participant_joined',
    'chat_message',
    'poll_created',
    'poll_ended',
    'poll_winner',
    'friend_request',
    'friend_accepted',
    'status_change',
    'engagement_friends_online',
    'engagement_comeback'
  )) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own notifications"
ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own notifications"
ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own notifications"
ON notifications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role can insert notifications"
ON notifications FOR INSERT WITH CHECK (true);

-- Push tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active) WHERE active = TRUE;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own push tokens"
ON push_tokens FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own push tokens"
ON push_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own push tokens"
ON push_tokens FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own push tokens"
ON push_tokens FOR DELETE USING (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT TRUE,
  plan_notifications BOOLEAN DEFAULT TRUE,
  chat_notifications BOOLEAN DEFAULT TRUE,
  friend_notifications BOOLEAN DEFAULT TRUE,
  status_notifications BOOLEAN DEFAULT TRUE,
  engagement_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage their own notification preferences"
ON notification_preferences FOR ALL USING (auth.uid() = user_id);

-- Auto create notification preferences for each new user
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER IF NOT EXISTS on_user_created_notification_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- Track last_active timestamp on user_status table
ALTER TABLE user_status 
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_status_last_active ON user_status(last_active);

UPDATE user_status 
SET last_active = COALESCE(last_seen, NOW())
WHERE last_active IS NULL;

-- Notification analytics view
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  user_id,
  COUNT(*) AS total_notifications,
  COUNT(*) FILTER (WHERE read = FALSE) AS unread_count,
  COUNT(*) FILTER (WHERE type = 'plan_invite') AS plan_invites,
  COUNT(*) FILTER (WHERE type = 'chat_message') AS chat_messages,
  COUNT(*) FILTER (WHERE type = 'friend_request') AS friend_requests,
  MAX(created_at) AS last_notification_at
FROM notifications
GROUP BY user_id;

COMMENT ON VIEW notification_stats IS 'Aggregated notification statistics per user';

-- Helper functions
CREATE OR REPLACE FUNCTION mark_all_notifications_read(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = target_user_id AND read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;