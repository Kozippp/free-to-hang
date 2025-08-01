#!/usr/bin/env node

/**
 * Database Check Script for Free2Hang
 * 
 * This script checks if your database schema is properly set up.
 * Run with: node scripts/check-database.js
 */

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5memJ2dXludHpnc3pxZGxzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNjk2MzcsImV4cCI6MjA2NDY0NTYzN30.GpWZXatLSPHm4QgFPOVUoRZJLD9Aqzz_hE-JqdcHiwc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('\n🔍 Checking Database Tables...\n');
  
  const tablesToCheck = [
    'users',
    'user_status', 
    'friends',
    'plans',
    'plan_participants'
  ];

  const results = {};

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        results[table] = `❌ ERROR: ${error.message}`;
      } else {
        results[table] = `✅ EXISTS`;
      }
    } catch (err) {
      results[table] = `❌ FAILED: ${err.message}`;
    }
  }

  // Display results
  console.log('Table Status:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const [table, status] of Object.entries(results)) {
    console.log(`${table.padEnd(20)} ${status}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return results;
}

async function checkTrigger() {
  console.log('🔍 Checking Database Trigger...\n');
  
  try {
    // Try to get information about the trigger function
    const { data, error } = await supabase.rpc('version'); // Simple RPC call to test
    
    if (error) {
      console.log('❌ Database connection issue:', error.message);
      return false;
    }
    
    console.log('✅ Database connection working');
    console.log('🔄 Trigger function check requires manual verification');
    return true;
    
  } catch (err) {
    console.log('❌ Database check failed:', err.message);
    return false;
  }
}

async function testUserCreation() {
  console.log('🧪 Testing User Creation Process...\n');
  
  const testEmail = `test+${Date.now()}@example.com`;
  
  try {
    console.log(`Testing registration with: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          name: 'Test User',
          username: 'testuser'
        }
      }
    });

    if (error) {
      console.log('❌ Registration failed:', error.message);
      
      if (error.message.includes('Database error')) {
        console.log('\n💡 This is the same error you\'re seeing!');
        console.log('The issue is likely that the database schema is not set up.');
      }
      
      return false;
    } else {
      console.log('✅ Registration successful!');
      console.log('User ID:', data.user?.id);
      
      // Clean up test user
      if (data.user) {
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('🧹 Test user cleaned up');
      }
      
      return true;
    }
    
  } catch (err) {
    console.log('❌ Test failed:', err.message);
    return false;
  }
}

async function provideSolution(tableResults) {
  console.log('💡 Solution:\n');
  
  const missingTables = Object.entries(tableResults)
    .filter(([table, status]) => status.includes('❌'))
    .map(([table, status]) => table);

  if (missingTables.length > 0) {
    console.log('🔧 Database schema is not set up properly.');
    console.log('\nTo fix this, you need to run the SQL setup:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Go to: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj');
    console.log('2. Click on "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy the contents of: supabase/reset-schema.sql');
    console.log('5. Paste it into the SQL editor');
    console.log('6. Click "Run" to execute');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nAlternatively, copy this file content:');
    console.log('📁 File: supabase/reset-schema.sql');
    
  } else {
    console.log('✅ All tables exist! The issue might be:');
    console.log('1. Missing trigger function');
    console.log('2. Permissions issue');
    console.log('3. Row Level Security (RLS) policy');
    console.log('\nTry running the schema setup again to ensure everything is configured.');
  }
}

async function main() {
  console.log('🔧 Free2Hang Database Diagnostic Tool\n');
  console.log('This will help identify why user registration is failing.\n');
  
  // Check database connection and tables
  const tableResults = await checkTables();
  
  // Check trigger
  await checkTrigger();
  
  // Test user creation
  await testUserCreation();
  
  // Provide solution
  await provideSolution(tableResults);
  
  console.log('\n📚 Need help? Check these files:');
  console.log('- docs/RESEND_TROUBLESHOOTING.md');
  console.log('- DATABASE_SETUP.md');
  console.log('- supabase/reset-schema.sql');
}

// Run the script
main().catch(console.error); 