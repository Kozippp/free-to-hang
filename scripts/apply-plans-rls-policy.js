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

async function applyPlansRLSPolicy() {
  try {
    console.log('📝 Reading plans RLS policy script...');
    const sql = fs.readFileSync('./scripts/update-plans-rls-policy.sql', 'utf8');

    console.log('🔧 Applying new plans SELECT RLS policy...');

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
    }

    console.log('✅ Plans SELECT RLS policy applied successfully!');
    console.log('🎉 Policy "Creators and participants can view plans" is now active');

  } catch (error) {
    console.error('❌ Script error:', error);
    console.error('\nTo apply this policy manually:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and paste the contents of scripts/update-plans-rls-policy.sql');
    console.error('4. Run the script');
    process.exit(1);
  }
}

applyPlansRLSPolicy();
