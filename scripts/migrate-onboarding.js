#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // This would need to be added to .env.local
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔄 Setting up onboarding database migration...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration in .env.local');
  console.log('\nPlease make sure you have:');
  console.log('- EXPO_PUBLIC_SUPABASE_URL');
  console.log('- EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.log('\nAlternatively, run this SQL script manually in your Supabase dashboard:');
  console.log('📁 scripts/add-onboarding-field.sql\n');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

async function runMigration() {
  try {
    console.log('✅ Connected to Supabase');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'add-onboarding-field.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Running migration...');
    
    // Split SQL into individual commands (simple approach)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('SELECT'));
    
    for (const command of commands) {
      if (command.trim()) {
        console.log(`   Executing: ${command.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: command });
        
        if (error && !error.message.includes('already exists')) {
          console.error(`❌ Error executing command: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Onboarding system is now ready to use.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Manual alternative:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Run the contents of scripts/add-onboarding-field.sql');
    process.exit(1);
  }
}

// Check if we can run the migration automatically
if (supabaseServiceKey) {
  runMigration();
} else {
  console.log('⚠️  Service role key not found. Please run the migration manually:');
  console.log('\n📋 Manual steps:');
  console.log('1. Go to: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj/sql');
  console.log('2. Click "New Query"');
  console.log('3. Copy and paste the contents of scripts/add-onboarding-field.sql');
  console.log('4. Click "Run"');
  console.log('\n📁 SQL file location: scripts/add-onboarding-field.sql');
} 