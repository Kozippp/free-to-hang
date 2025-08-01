const { createClient } = require('@supabase/supabase-js');

// These should be set in your environment or you can hardcode them temporarily for testing
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

console.log('🔍 Environment check:');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyPlansSchema() {
  console.log('🚀 Applying plans schema...');

  try {
    // 1. Create plan_polls table
    console.log('📊 Creating plan_polls table...');
    const { error: pollsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_polls (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          poll_type TEXT CHECK (poll_type IN ('when', 'where', 'custom', 'invitation')) NOT NULL,
          ends_at TIMESTAMP WITH TIME ZONE,
          invited_users TEXT[],
          created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (pollsError) {
      console.error('❌ Error creating plan_polls:', pollsError);
    } else {
      console.log('✅ plan_polls table created');
    }

    // 2. Create plan_poll_options table
    console.log('📝 Creating plan_poll_options table...');
    const { error: optionsError } = await supabase.rpc('exec_sql', {
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

    if (optionsError) {
      console.error('❌ Error creating plan_poll_options:', optionsError);
    } else {
      console.log('✅ plan_poll_options table created');
    }

    // 3. Create plan_poll_votes table
    console.log('🗳️ Creating plan_poll_votes table...');
    const { error: votesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_poll_votes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE NOT NULL,
          option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(poll_id, option_id, user_id)
        );
      `
    });

    if (votesError) {
      console.error('❌ Error creating plan_poll_votes:', votesError);
    } else {
      console.log('✅ plan_poll_votes table created');
    }

    // 4. Create plan_completion_votes table
    console.log('✅ Creating plan_completion_votes table...');
    const { error: completionError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_completion_votes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(plan_id, user_id)
        );
      `
    });

    if (completionError) {
      console.error('❌ Error creating plan_completion_votes:', completionError);
    } else {
      console.log('✅ plan_completion_votes table created');
    }

    // 5. Create plan_attendance table
    console.log('📋 Creating plan_attendance table...');
    const { error: attendanceError } = await supabase.rpc('exec_sql', {
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

    if (attendanceError) {
      console.error('❌ Error creating plan_attendance:', attendanceError);
    } else {
      console.log('✅ plan_attendance table created');
    }

    // 6. Create plan_updates table
    console.log('📢 Creating plan_updates table...');
    const { error: updatesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_updates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
          update_type TEXT CHECK (update_type IN ('poll_created', 'poll_voted', 'poll_won', 'participant_joined', 'participant_left', 'plan_completed', 'new_message', 'participant_accepted_conditionally')) NOT NULL,
          triggered_by UUID REFERENCES users(id) ON DELETE CASCADE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (updatesError) {
      console.error('❌ Error creating plan_updates:', updatesError);
    } else {
      console.log('✅ plan_updates table created');
    }

    // 7. Add indexes
    console.log('🔍 Creating indexes...');
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_plan_polls_plan_id ON plan_polls(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_poll_options_poll_id ON plan_poll_options(poll_id);
        CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_poll_id ON plan_poll_votes(poll_id);
        CREATE INDEX IF NOT EXISTS idx_plan_poll_votes_user_id ON plan_poll_votes(user_id);
        CREATE INDEX IF NOT EXISTS idx_plan_completion_votes_plan_id ON plan_completion_votes(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_attendance_plan_id ON plan_attendance(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_updates_plan_id ON plan_updates(plan_id);
      `
    });

    if (indexesError) {
      console.error('❌ Error creating indexes:', indexesError);
    } else {
      console.log('✅ Indexes created');
    }

    // 8. Enable RLS
    console.log('🔒 Enabling RLS...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE plan_polls ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_poll_options ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_poll_votes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_completion_votes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_attendance ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_updates ENABLE ROW LEVEL SECURITY;
      `
    });

    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
    } else {
      console.log('✅ RLS enabled');
    }

    // 9. Create basic RLS policies
    console.log('🛡️ Creating RLS policies...');
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
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

    if (policiesError) {
      console.error('❌ Error creating policies:', policiesError);
    } else {
      console.log('✅ RLS policies created');
    }

    // 10. Fix plan_participants table
    console.log('🔧 Fixing plan_participants table...');
    const { error: fixError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add status column if it doesn't exist
        ALTER TABLE plan_participants ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted', 'maybe', 'declined', 'conditional')) DEFAULT 'pending';
        
        -- Copy data from response to status if response exists
        UPDATE plan_participants SET status = response WHERE response IS NOT NULL AND status = 'pending';
        
        -- Drop response column if it exists
        ALTER TABLE plan_participants DROP COLUMN IF EXISTS response;
      `
    });

    if (fixError) {
      console.error('❌ Error fixing plan_participants:', fixError);
    } else {
      console.log('✅ plan_participants table fixed');
    }

    console.log('🎉 Plans schema applied successfully!');

  } catch (error) {
    console.error('❌ Error applying plans schema:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  applyPlansSchema()
    .then(() => {
      console.log('✅ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyPlansSchema }; 