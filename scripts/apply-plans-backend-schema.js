const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyPlansBackendSchema() {
  console.log('🚀 Applying plans backend schema...');

  try {
    // 1. Create plan_polls table
    console.log('📊 Creating plan_polls table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_polls (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
          ends_at TIMESTAMP WITH TIME ZONE,
          invited_users TEXT[], -- JSON array for invitation polls
          created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // 2. Create plan_poll_options table
    console.log('📝 Creating plan_poll_options table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_poll_options (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
          option_text TEXT NOT NULL,
          option_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // 3. Create plan_poll_votes table
    console.log('🗳️ Creating plan_poll_votes table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_poll_votes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
          option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(poll_id, option_id, user_id) -- User can vote once per option per poll
        );
      `
    });

    // 4. Create plan_completion_votes table
    console.log('✅ Creating plan_completion_votes table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_completion_votes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(plan_id, user_id) -- User can vote once per plan
        );
      `
    });

    // 5. Create plan_attendance table
    console.log('📋 Creating plan_attendance table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_attendance (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          attended BOOLEAN NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(plan_id, user_id)
        );
      `
    });

    // 6. Create plan_updates table
    console.log('📢 Creating plan_updates table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_updates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          update_type TEXT CHECK (update_type IN ('poll_created', 'poll_voted', 'poll_won', 'participant_joined', 'participant_left', 'plan_completed', 'new_message', 'participant_accepted_conditionally')) NOT NULL,
          triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
          metadata JSONB, -- Additional data like poll_id, option_id, etc.
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // 7. Add indexes for performance
    console.log('🔍 Creating indexes...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id ON plan_polls(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_polls_expires_at ON plan_polls(ends_at) WHERE ends_at IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);
        CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
        CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);
        CREATE INDEX IF NOT EXISTS idx_plan_completion_votes_plan_id ON plan_completion_votes(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_attendance_plan_id ON plan_attendance(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id ON plan_updates(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_updates_created_at ON plan_updates(created_at);
      `
    });

    // 8. Enable RLS on all new tables
    console.log('🔒 Enabling RLS on new tables...');
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_completion_votes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;
      `
    });

    // 9. Create RLS policies
    console.log('🛡️ Creating RLS policies...');
    await supabase.rpc('exec_sql', {
      sql: `
        -- Plan polls policies
        DROP POLICY IF EXISTS "Users can view polls for their plans" ON plan_polls;
        CREATE POLICY "Users can view polls for their plans" ON plan_polls FOR SELECT USING (
          plan_id IN (
            SELECT id FROM plans WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
          )
        );

        DROP POLICY IF EXISTS "Plan participants can create polls" ON plan_polls;
        CREATE POLICY "Plan participants can create polls" ON plan_polls FOR INSERT WITH CHECK (
          plan_id IN (
            SELECT id FROM plans WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'accepted')
          ) AND created_by = auth.uid()
        );

        DROP POLICY IF EXISTS "Poll creators can update their polls" ON plan_polls;
        CREATE POLICY "Poll creators can update their polls" ON plan_polls FOR UPDATE USING (
          created_by = auth.uid()
        );

        -- Poll options policies
        DROP POLICY IF EXISTS "Users can view poll options" ON plan_poll_options;
        CREATE POLICY "Users can view poll options" ON plan_poll_options FOR SELECT USING (
          poll_id IN (
            SELECT id FROM plan_polls WHERE plan_id IN (
              SELECT id FROM plans WHERE 
              creator_id = auth.uid() OR 
              id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
            )
          )
        );

        DROP POLICY IF EXISTS "Users can manage poll options" ON plan_poll_options;
        CREATE POLICY "Users can manage poll options" ON plan_poll_options FOR ALL USING (
          poll_id IN (
            SELECT id FROM plan_polls WHERE created_by = auth.uid()
          )
        );

        -- Poll votes policies
        DROP POLICY IF EXISTS "Users can view poll votes" ON plan_poll_votes;
        CREATE POLICY "Users can view poll votes" ON plan_poll_votes FOR SELECT USING (
          poll_id IN (
            SELECT id FROM plan_polls WHERE plan_id IN (
              SELECT id FROM plans WHERE 
              creator_id = auth.uid() OR 
              id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
            )
          )
        );

        DROP POLICY IF EXISTS "Users can manage their own votes" ON plan_poll_votes;
        CREATE POLICY "Users can manage their own votes" ON plan_poll_votes FOR ALL USING (
          user_id = auth.uid()
        );

        -- Completion votes policies
        DROP POLICY IF EXISTS "Users can view completion votes" ON plan_completion_votes;
        CREATE POLICY "Users can view completion votes" ON plan_completion_votes FOR SELECT USING (
          plan_id IN (
            SELECT id FROM plans WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
          )
        );

        DROP POLICY IF EXISTS "Users can manage their completion votes" ON plan_completion_votes;
        CREATE POLICY "Users can manage their completion votes" ON plan_completion_votes FOR ALL USING (
          user_id = auth.uid()
        );

        -- Attendance policies
        DROP POLICY IF EXISTS "Users can view plan attendance" ON plan_attendance;
        CREATE POLICY "Users can view plan attendance" ON plan_attendance FOR SELECT USING (
          plan_id IN (
            SELECT id FROM plans WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
          )
        );

        DROP POLICY IF EXISTS "Users can manage their attendance" ON plan_attendance;
        CREATE POLICY "Users can manage their attendance" ON plan_attendance FOR ALL USING (
          user_id = auth.uid()
        );

        -- Plan updates policies
        DROP POLICY IF EXISTS "Users can view plan updates" ON plan_updates;
        CREATE POLICY "Users can view plan updates" ON plan_updates FOR SELECT USING (
          plan_id IN (
            SELECT id FROM plans WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
          )
        );

        -- Service role policies for backend operations
        DROP POLICY IF EXISTS "Service role can manage all plan data" ON plan_polls;
        CREATE POLICY "Service role can manage all plan data" ON plan_polls FOR ALL USING (auth.uid() IS NULL);
        
        DROP POLICY IF EXISTS "Service role can manage all poll options" ON plan_poll_options;
        CREATE POLICY "Service role can manage all poll options" ON plan_poll_options FOR ALL USING (auth.uid() IS NULL);
        
        DROP POLICY IF EXISTS "Service role can manage all poll votes" ON plan_poll_votes;
        CREATE POLICY "Service role can manage all poll votes" ON plan_poll_votes FOR ALL USING (auth.uid() IS NULL);
        
        DROP POLICY IF EXISTS "Service role can manage all completion votes" ON plan_completion_votes;
        CREATE POLICY "Service role can manage all completion votes" ON plan_completion_votes FOR ALL USING (auth.uid() IS NULL);
        
        DROP POLICY IF EXISTS "Service role can manage all attendance" ON plan_attendance;
        CREATE POLICY "Service role can manage all attendance" ON plan_attendance FOR ALL USING (auth.uid() IS NULL);
        
        DROP POLICY IF EXISTS "Service role can manage all plan updates" ON plan_updates;
        CREATE POLICY "Service role can manage all plan updates" ON plan_updates FOR ALL USING (auth.uid() IS NULL);
      `
    });

    // 10. Add triggers for updated_at timestamps
    console.log('⏰ Creating triggers...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_plan_polls_updated_at BEFORE UPDATE ON plan_polls 
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

        CREATE TRIGGER IF NOT EXISTS update_plan_attendance_updated_at BEFORE UPDATE ON plan_attendance 
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `
    });

    // 11. Fix plan_participants table to use 'status' instead of 'response'
    console.log('🔧 Fixing plan_participants table...');
    await supabase.rpc('exec_sql', {
      sql: `
        -- Add status column if it doesn't exist
        ALTER TABLE plan_participants ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted', 'maybe', 'declined', 'conditional')) DEFAULT 'pending';
        
        -- Copy data from response to status if response exists
        UPDATE plan_participants SET status = response WHERE response IS NOT NULL AND status = 'pending';
        
        -- Drop response column if it exists
        ALTER TABLE plan_participants DROP COLUMN IF EXISTS response;
      `
    });

    console.log('✅ Plans backend schema applied successfully!');
    
    // Test the setup
    console.log('🧪 Testing schema...');
    const { data: tables, error } = await supabase
      .from('plan_polls')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('⚠️ Test query failed:', error.message);
    } else {
      console.log('✅ Schema test passed!');
    }

  } catch (error) {
    console.error('❌ Error applying plans backend schema:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  applyPlansBackendSchema()
    .then(() => {
      console.log('🎉 Plans backend schema setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyPlansBackendSchema }; 