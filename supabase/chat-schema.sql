-- ============================================
-- CHAT SYSTEM DATABASE SCHEMA
-- ============================================
-- This schema supports plan-centric chat functionality
-- with real-time messaging, reactions, and read receipts

-- ============================================
-- Chat Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Message type and content
  type TEXT CHECK (type IN ('text', 'image', 'voice', 'poll')) DEFAULT 'text' NOT NULL,
  content TEXT,
  
  -- Media URLs (for image and voice messages)
  image_url TEXT,
  voice_url TEXT,
  voice_duration INTEGER, -- Duration in seconds for voice messages
  
  -- Reply functionality
  reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  
  -- Message state
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_plan_id ON chat_messages(plan_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_plan_created ON chat_messages(plan_id, created_at DESC);

-- ============================================
-- Chat Reactions Table
-- ============================================
CREATE TABLE IF NOT EXISTS chat_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- One reaction per user per message (user can change their reaction)
  CONSTRAINT unique_user_message_reaction UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id ON chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user_id ON chat_reactions(user_id);

-- ============================================
-- Chat Read Receipts Table
-- ============================================
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- One receipt per user per plan
  CONSTRAINT unique_user_plan_receipt UNIQUE(plan_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_plan_id ON chat_read_receipts(plan_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_user_id ON chat_read_receipts(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Plan participants can view messages
CREATE POLICY "Plan participants can view messages"
ON chat_messages FOR SELECT
USING (
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

-- Plan participants can create messages
CREATE POLICY "Plan participants can create messages"
ON chat_messages FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

-- Users can update their own messages (for editing)
CREATE POLICY "Users can update their own messages"
ON chat_messages FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON chat_messages FOR DELETE
USING (user_id = auth.uid());

-- Enable RLS on chat_reactions
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Plan participants can view reactions
CREATE POLICY "Plan participants can view reactions"
ON chat_reactions FOR SELECT
USING (
  message_id IN (
    SELECT id FROM chat_messages WHERE plan_id IN (
      SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
    )
  )
);

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON chat_reactions FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  message_id IN (
    SELECT id FROM chat_messages WHERE plan_id IN (
      SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
    )
  )
);

-- Users can update their reactions
CREATE POLICY "Users can update their reactions"
ON chat_reactions FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their reactions
CREATE POLICY "Users can delete their reactions"
ON chat_reactions FOR DELETE
USING (user_id = auth.uid());

-- Enable RLS on chat_read_receipts
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Plan participants can view read receipts
CREATE POLICY "Plan participants can view read receipts"
ON chat_read_receipts FOR SELECT
USING (
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

-- Users can manage their own read receipts
CREATE POLICY "Users can insert their read receipts"
ON chat_read_receipts FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their read receipts"
ON chat_read_receipts FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for chat_messages updated_at
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_message_updated_at();

-- ============================================
-- STORAGE BUCKET FOR CHAT IMAGES
-- ============================================

-- Create storage bucket for chat images (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-images bucket
DROP POLICY IF EXISTS "Chat images are publicly accessible" ON storage.objects;
CREATE POLICY "Chat images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can update their chat images" ON storage.objects;
CREATE POLICY "Users can update their chat images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Users can delete their chat images" ON storage.objects;
CREATE POLICY "Users can delete their chat images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- ============================================
-- HELPER VIEWS (Optional - for analytics)
-- ============================================

-- View: Message count per plan
CREATE OR REPLACE VIEW chat_message_counts AS
SELECT 
  plan_id,
  COUNT(*) as total_messages,
  COUNT(DISTINCT user_id) as active_users,
  MAX(created_at) as last_message_at
FROM chat_messages
WHERE deleted = FALSE
GROUP BY plan_id;

-- View: Unread messages count per user per plan
CREATE OR REPLACE VIEW chat_unread_counts AS
SELECT 
  cm.plan_id,
  pp.user_id,
  COUNT(cm.id) as unread_count
FROM chat_messages cm
JOIN plan_participants pp ON cm.plan_id = pp.plan_id
LEFT JOIN chat_read_receipts crr ON crr.plan_id = cm.plan_id AND crr.user_id = pp.user_id
WHERE 
  cm.deleted = FALSE 
  AND cm.user_id != pp.user_id
  AND (
    crr.last_read_at IS NULL 
    OR cm.created_at > crr.last_read_at
  )
GROUP BY cm.plan_id, pp.user_id;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE chat_messages IS 'Stores all chat messages for plans. Messages are plan-centric and support text, images, voice, and polls.';
COMMENT ON TABLE chat_reactions IS 'Stores emoji reactions to messages. One reaction per user per message.';
COMMENT ON TABLE chat_read_receipts IS 'Tracks read status of messages per user per plan.';

COMMENT ON COLUMN chat_messages.type IS 'Type of message: text, image, voice, or poll';
COMMENT ON COLUMN chat_messages.content IS 'Text content of the message. Required for text messages, optional for others.';
COMMENT ON COLUMN chat_messages.reply_to_message_id IS 'Reference to the message being replied to (if any)';
COMMENT ON COLUMN chat_messages.deleted IS 'Soft delete flag. Deleted messages are hidden but kept for history.';
COMMENT ON COLUMN chat_messages.edited IS 'Flag indicating if the message has been edited';

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_read_receipts TO authenticated;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Chat system database schema created successfully!';
  RAISE NOTICE '📊 Created tables: chat_messages, chat_reactions, chat_read_receipts';
  RAISE NOTICE '🔒 RLS policies enabled and configured';
  RAISE NOTICE '📦 Storage bucket "chat-images" configured';
  RAISE NOTICE '🎯 Ready for backend implementation!';
END $$;

