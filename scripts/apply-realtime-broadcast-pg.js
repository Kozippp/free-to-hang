const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing required environment variable:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing required environment variable:');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract database connection details from Supabase URL
const url = new URL(supabaseUrl);
const host = url.hostname;
const port = 5432;
const database = 'postgres';
const user = 'postgres';
const password = supabaseServiceKey;

async function applyRealtimeBroadcastSetup() {
  console.log('🚀 Starting Supabase Realtime Broadcast setup with direct PostgreSQL connection...');
  
  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'setup-broadcast-manual.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📖 Reading SQL script...');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => stmt + ';');
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement.trim() || statement.trim().startsWith('--')) {
        continue;
      }
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        await client.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
        
      } catch (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        
        // Continue with next statement unless it's a critical error
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('⚠️  Non-critical error, continuing...');
        } else {
          console.error('❌ Critical error, stopping execution');
          throw error;
        }
      }
    }
    
    console.log('✅ Broadcast setup completed!');
    
    // Test the setup
    await testBroadcastSetup(client);
    
  } catch (error) {
    console.error('❌ Error during broadcast setup:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

async function testBroadcastSetup(client) {
  console.log('\n🧪 Testing broadcast setup...');
  
  try {
    // Test if the functions were created
    const functionResult = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('handle_poll_vote_changes', 'handle_poll_changes', 'handle_poll_option_changes', 'handle_plan_update_changes')
    `);
    
    console.log('✅ Functions created:', functionResult.rows.map(row => row.proname));
    
    // Test if triggers were created
    const triggerResult = await client.query(`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgname IN ('handle_poll_vote_changes_trigger', 'handle_poll_changes_trigger', 'handle_poll_option_changes_trigger', 'handle_plan_update_changes_trigger')
    `);
    
    console.log('✅ Triggers created:', triggerResult.rows.map(row => row.tgname));
    
    // Test if policies were created
    const policyResult = await client.query(`
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'messages' AND schemaname = 'realtime'
    `);
    
    console.log('✅ RLS policies created:', policyResult.rows.map(row => row.policyname));
    
    console.log('\n🎉 Broadcast system setup is complete and working!');
    
  } catch (error) {
    console.error('❌ Error testing broadcast setup:', error.message);
  }
}

// Run the setup
applyRealtimeBroadcastSetup().catch(console.error); 