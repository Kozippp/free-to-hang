-- ============================================
-- NOTIFICATION SYSTEM DATABASE SCHEMA
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- to set up the notification system

-- ============================================
-- 1. NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification type and content
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
  
  -- Navigation data (JSONB for flexibility)
  data JSONB DEFAULT '{}'::jsonb,
  
  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional: who triggered this notification
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);

-- Service role can insert notifications (from backend)
CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE notifications IS 'Stores all user notifications for the in-app notification center';

-- ============================================
-- 2. PUSH TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  expo_push_token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) NOT NULL,
  
  active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One active token per device
  UNIQUE(user_id, expo_push_token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active) WHERE active = TRUE;

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can insert their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete their own push tokens" ON push_tokens;

-- RLS Policies
CREATE POLICY "Users can view their own push tokens"
ON push_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
ON push_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
ON push_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
ON push_tokens FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE push_tokens IS 'Stores Expo push notification tokens for each user device';

-- ============================================
-- 3. NOTIFICATION PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Push notification toggles
  push_enabled BOOLEAN DEFAULT TRUE,
  
  -- Category toggles
  plan_notifications BOOLEAN DEFAULT TRUE,
  chat_notifications BOOLEAN DEFAULT TRUE,
  friend_notifications BOOLEAN DEFAULT TRUE,
  status_notifications BOOLEAN DEFAULT TRUE,
  engagement_notifications BOOLEAN DEFAULT TRUE,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;

-- RLS Policies
CREATE POLICY "Users can manage their own notification preferences"
ON notification_preferences FOR ALL
USING (auth.uid() = user_id);

COMMENT ON TABLE notification_preferences IS 'User notification preferences and settings';

-- ============================================
-- 4. AUTO-CREATE PREFERENCES TRIGGER
-- ============================================

-- Drop existing function and trigger if any
DROP TRIGGER IF EXISTS on_user_created_notification_prefs ON users;
DROP FUNCTION IF EXISTS create_notification_preferences();

-- Create function to auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- ============================================
-- 5. UPDATE user_status TABLE
-- ============================================

-- Add last_active column to track when user was last active in app
ALTER TABLE user_status 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for engagement queries
CREATE INDEX IF NOT EXISTS idx_user_status_last_active ON user_status(last_active);

-- Update existing rows to have last_active value
UPDATE user_status 
SET last_active = COALESCE(last_seen, NOW())
WHERE last_active IS NULL;

COMMENT ON COLUMN user_status.last_active IS 'Timestamp of when user was last active in the app (updated every 5 minutes)';

-- ============================================
-- 6. CREATE VIEWS FOR ANALYTICS
-- ============================================

-- Drop existing views if any
DROP VIEW IF EXISTS notification_stats;

-- View: Notification statistics per user
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE type = 'plan_invite') as plan_invites,
  COUNT(*) FILTER (WHERE type = 'chat_message') as chat_messages,
  COUNT(*) FILTER (WHERE type = 'friend_request') as friend_requests,
  MAX(created_at) as last_notification_at
FROM notifications
GROUP BY user_id;

COMMENT ON VIEW notification_stats IS 'Aggregated notification statistics per user';

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to mark all notifications as read for a user
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

COMMENT ON FUNCTION mark_all_notifications_read IS 'Mark all unread notifications as read for a specific user';

-- Function to clean up old notifications (older than 90 days)
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

COMMENT ON FUNCTION cleanup_old_notifications IS 'Delete notifications older than 90 days';

-- ============================================
-- 8. BACKFILL PREFERENCES FOR EXISTING USERS
-- ============================================

-- Create notification preferences for all existing users who don't have them
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 9. VERIFY INSTALLATION
-- ============================================

-- Check that all tables exist
DO $$
DECLARE
  missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check notifications table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    missing_tables := array_append(missing_tables, 'notifications');
  END IF;
  
  -- Check push_tokens table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_tokens') THEN
    missing_tables := array_append(missing_tables, 'push_tokens');
  END IF;
  
  -- Check notification_preferences table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
    missing_tables := array_append(missing_tables, 'notification_preferences');
  END IF;
  
  -- Report results
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✅ All notification system tables created successfully!';
  END IF;
END $$;

-- Show table counts
SELECT 
  'notifications' as table_name, 
  COUNT(*) as row_count 
FROM notifications
UNION ALL
SELECT 
  'push_tokens' as table_name, 
  COUNT(*) as row_count 
FROM push_tokens
UNION ALL
SELECT 
  'notification_preferences' as table_name, 
  COUNT(*) as row_count 
FROM notification_preferences;

-- ============================================
-- INSTALLATION COMPLETE! ✅
-- ============================================

-- Next steps:
-- 1. Install backend dependencies: cd backend && npm install expo-server-sdk node-cron
-- 2. Install frontend dependencies: npx expo install expo-notifications expo-device
-- 3. Follow the implementation guide in docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md
-- 4. Test with CODEX_NOTIFICATIONS_PROMPT.txt

RAISE NOTICE '🎉 Notification system database schema installed successfully!';
RAISE NOTICE '📖 Next: Follow docs/NOTIFICATIONS_SYSTEM_IMPLEMENTATION_GUIDE.md';

