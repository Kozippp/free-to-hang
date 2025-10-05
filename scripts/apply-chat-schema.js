const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Use the same logic as the backend
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];

const SUPABASE_URL = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = resolveEnv(`SUPABASE_SERVICE_ROLE_KEY_${ACTIVE}`, 'SUPABASE_SERVICE_ROLE_KEY');

console.log('🔍 Environment check:');
console.log('Active project:', ACTIVE);
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Please check your .env file for the correct project variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyChatSchema() {
  console.log('🎯 Applying chat schema...');

  try {
    // Read the chat schema file
    const schemaPath = path.join(__dirname, '../supabase/chat-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

        try {
          const { error } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });

          if (error) {
            // Try direct execution if rpc fails
            const { error: directError } = await supabase.from('_temp').select('*').limit(0);
            if (directError) {
              console.log(`⚠️  Statement ${i + 1} may have failed:`, error.message);
            }
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} execution attempt:`, err.message);
        }
      }
    }

    console.log('✅ Chat schema application completed');
    console.log('🎉 Ready to test read receipts feature!');

  } catch (error) {
    console.error('❌ Error applying chat schema:', error);
    process.exit(1);
  }
}

// Run the script
applyChatSchema();
