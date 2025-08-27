const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Please set your service role key in your .env file or environment variables');
  console.error('You can find your service role key in your Supabase dashboard under Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyCreatePlanRPC() {
  try {
    console.log('📝 Reading create_plan_with_participants RPC script...');
    const sql = fs.readFileSync('./scripts/create-plan-with-participants-rpc.sql', 'utf8');

    console.log('🔧 Applying create_plan_with_participants RPC function...');

    // Execute the SQL using rpc exec_sql if available, otherwise try direct execution
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: sql
      });

      if (error) {
        throw error;
      }
    } catch (rpcError) {
      console.log('RPC method not available, trying alternative approach...');
      throw new Error('Please apply the SQL script manually in your Supabase dashboard SQL Editor');
    }

    console.log('✅ create_plan_with_participants RPC function applied successfully!');

  } catch (error) {
    console.error('❌ Script error:', error);
    console.error('\nTo apply this RPC manually:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and paste the contents of scripts/create-plan-with-participants-rpc.sql');
    console.error('4. Run the script');
    console.error('\nAfter applying the RPC, you can update the plans service to use it.');
    process.exit(1);
  }
}

applyCreatePlanRPC();
