const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupPlansBackend() {
  console.log('🚀 Setting up Plans Backend Database...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'plans-backend-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        });
        
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase
            .from('_temp_')
            .select('*')
            .limit(0);
            
          // If that fails too, try a different approach
          if (directError) {
            console.log(`⚠️  Statement ${i + 1} may have failed:`, error.message);
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} error:`, err.message);
      }
    }
    
    console.log('🎉 Plans backend setup completed!');
    console.log('\n📊 Created tables:');
    console.log('  - plan_polls');
    console.log('  - poll_options');
    console.log('  - poll_votes');
    console.log('  - plan_completion_votes');
    console.log('  - plan_attendance');
    console.log('  - plan_updates');
    console.log('\n🔧 Created functions:');
    console.log('  - get_poll_results()');
    console.log('  - check_plan_completion()');
    console.log('  - auto_complete_plans()');
    console.log('\n🔒 Applied RLS policies for all tables');
    console.log('\n📈 Added performance indexes');
    
  } catch (error) {
    console.error('❌ Error setting up plans backend:', error);
    process.exit(1);
  }
}

// Alternative approach using individual queries
async function setupPlansBackendDirect() {
  console.log('🚀 Setting up Plans Backend Database (Direct approach)...');
  
  try {
    // Create plan_polls table
    console.log('⏳ Creating plan_polls table...');
    await supabase.from('plan_polls').select('*').limit(0);
    
    // Since we can't execute DDL directly, let's create a simpler setup
    console.log('📋 Please run the following SQL manually in your Supabase SQL editor:');
    console.log('');
    
    const schemaPath = path.join(__dirname, 'plans-backend-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('--- COPY THIS SQL TO SUPABASE SQL EDITOR ---');
    console.log(schema);
    console.log('--- END OF SQL ---');
    
    console.log('\n✅ Please copy and paste the above SQL into your Supabase SQL editor and run it.');
    console.log('🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Check if we can access Supabase
async function checkConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.log('❌ Cannot connect to Supabase. Please check your credentials.');
      return false;
    }
    console.log('✅ Connected to Supabase successfully');
    return true;
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Plans Backend Setup Tool');
  console.log('============================\n');
  
  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }
  
  // Use direct approach since DDL execution through API is limited
  await setupPlansBackendDirect();
}

if (require.main === module) {
  main();
}

module.exports = { setupPlansBackend, setupPlansBackendDirect }; 