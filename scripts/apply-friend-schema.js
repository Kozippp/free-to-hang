const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

console.log('🔍 Environment check:');
console.log('SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing');

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables');
  console.log('📋 Please apply the following SQL manually in your Supabase dashboard:');
  console.log('');
  console.log('-- Step 1: Create the friend_requests table');
  console.log(`
CREATE TABLE friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate requests between same users
  UNIQUE(sender_id, receiver_id),
  
  -- Prevent self-requests
  CHECK (sender_id != receiver_id)
);
  `);
  
  console.log('-- Step 2: Create indexes');
  console.log(`
CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
CREATE INDEX idx_friend_requests_sender_status ON friend_requests(sender_id, status);
CREATE INDEX idx_friend_requests_receiver_status ON friend_requests(receiver_id, status);
  `);
  
  console.log('-- Step 3: Enable RLS');
  console.log(`
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
  `);
  
  console.log('-- Step 4: Create RLS policies');
  console.log(`
-- Users can view requests they sent or received
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/decline) or sent (cancel)
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
  `);
  
  console.log('-- Step 5: Create trigger function');
  console.log(`
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
  `);
  
  console.log('-- Step 6: Create trigger');
  console.log(`
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
  
  console.log('');
  console.log('📝 Instructions:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the SQL statements above');
  console.log('4. Run each step one by one');
  console.log('5. Then run: node create-friend-functions.js');
  
  process.exit(0);
}

// If we have the environment variables, try to proceed
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY // Note: This won't work for DDL operations
);

console.log('⚠️  Note: This script requires service role key for DDL operations.');
console.log('📋 Please apply the SQL manually as shown above.');
console.log('✅ Backend API is ready to use once database schema is applied.'); 