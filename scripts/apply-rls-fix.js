const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(
  'https://nfzbvuyntzgszqdlsusl.supabase.co',
  supabaseServiceKey
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