const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://nfzbvuyntzgszqdlsusl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5memJ2dXludHpnc3pxZGxzdXNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA5OTcwMCwiZXhwIjoyMDUxNjc1NzAwfQ.RcB-1tCdRYJxH8FWJXfvCl1VEgd7cjPUOmMQlTSPJFY'
);

async function fixRLS() {
  try {
    console.log('📝 Reading RLS fix script...');
    const sql = fs.readFileSync('fix-rls-policies.sql', 'utf8');
    
    console.log('🔧 Applying RLS policy fixes...');
    
    // Split the SQL into individual statements and execute them
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        console.log(`Executing: ${trimmedStatement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: trimmedStatement + ';' 
        });
        
        if (error) {
          console.error('❌ Error executing statement:', error);
          console.error('Statement was:', trimmedStatement);
          process.exit(1);
        }
      }
    }
    
    console.log('✅ RLS policies fixed successfully!');
    console.log('🎉 Friend requests should now work properly');
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

fixRLS(); 