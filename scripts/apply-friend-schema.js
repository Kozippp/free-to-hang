const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyFriendSchema() {
  console.log('🚀 Applying friend system database schema...');
  
  try {
    // Step 1: Drop existing tables
    console.log('🗑️ Dropping existing tables...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP TABLE IF EXISTS friend_requests CASCADE;
        DROP TABLE IF EXISTS friendships CASCADE;
      `
    });
    
    // Step 2: Create friend_requests table
    console.log('📋 Creating friend_requests table...');
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (createTableError) throw createTableError;
    
    // Step 3: Create indexes
    console.log('🔍 Creating indexes...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
        CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);
        CREATE INDEX idx_friend_requests_status ON friend_requests(status);
        CREATE INDEX idx_friend_requests_sender_status ON friend_requests(sender_id, status);
        CREATE INDEX idx_friend_requests_receiver_status ON friend_requests(receiver_id, status);
      `
    });
    
    // Step 4: Enable RLS
    console.log('🔒 Enabling Row Level Security...');
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;`
    });
    
    // Step 5: Create RLS policies
    console.log('📋 Creating RLS policies...');
    await supabase.rpc('exec_sql', {
      sql: `
        -- Users can view requests they sent or received
        CREATE POLICY "Users can view own friend requests" ON friend_requests
          FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

        -- Users can create friend requests (as sender)
        CREATE POLICY "Users can create friend requests" ON friend_requests
          FOR INSERT WITH CHECK (auth.uid() = sender_id);

        -- Users can update requests they received (accept/decline) or sent (cancel)
        CREATE POLICY "Users can update own friend requests" ON friend_requests
          FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
      `
    });
    
    // Step 6: Create trigger function
    console.log('⚡ Creating trigger function...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `
    });
    
    // Step 7: Create trigger
    console.log('🎯 Creating trigger...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TRIGGER update_friend_requests_updated_at
            BEFORE UPDATE ON friend_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `
    });
    
    console.log('✅ Friend system database schema applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  }
}

// Run the schema application
applyFriendSchema(); 