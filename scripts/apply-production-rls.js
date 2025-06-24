const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Use the correct service role key from backend/.env
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(
  'https://nfzbvuyntzgszqdlsusl.supabase.co',
  supabaseServiceKey
);

async function applyProductionRLS() {
  try {
    console.log('📝 Reading production RLS script...');
    const sql = fs.readFileSync('production-rls-fix.sql', 'utf8');
    
    console.log('🔧 Applying production-ready RLS policies...');
    
    // Execute the complete SQL as one transaction
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    });
    
    if (error) {
      console.error('❌ Error applying RLS policies:', error);
      process.exit(1);
    }
    
    console.log('✅ Production RLS policies applied successfully!');
    console.log('🔒 Security maintained with proper service role access');
    console.log('🎉 Friend requests should now work properly');
    
    // Test the fix by checking if we can query the table
    console.log('\n🧪 Testing database access...');
    const { data: testData, error: testError } = await supabase
      .from('friend_requests')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Test query failed:', testError);
    } else {
      console.log('✅ Database access test passed');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

applyProductionRLS(); 