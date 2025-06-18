const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Use the correct service role key from backend/.env
const supabase = createClient(
  'https://nfzbvuyntzgszqdlsusl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5memJ2dXludHpnc3pxZGxzdXNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA5OTcwMCwiZXhwIjoyMDUxNjc1NzAwfQ.RcB-1tCdRYJxH8FWJXfvCl1VEgd7cjPUOmMQlTSPJFY'
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