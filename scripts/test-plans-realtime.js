#!/usr/bin/env node

/**
 * Test Plans Realtime Functionality
 *
 * This script helps test if plans realtime is working by:
 * 1. Creating a test plan update notification
 * 2. Checking if the plan_updates table exists and has realtime enabled
 */

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealtimeTables() {
  console.log('\n🔍 Checking Realtime Tables...\n');

  const tablesToCheck = [
    'plan_updates',
    'plan_participants',
    'plan_polls',
    'plan_poll_votes'
  ];

  for (const table of tablesToCheck) {
    try {
      // Try to select from the table
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: EXISTS`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
}

async function checkRealtimePublications() {
  console.log('\n📡 Checking Realtime Publications...\n');

  try {
    // Check which tables are in the realtime publication
    const { data, error } = await supabase.rpc('query', {
      sql: `
        SELECT schemaname, tablename
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename LIKE 'plan_%'
        ORDER BY tablename;
      `
    });

    if (error) {
      console.log('❌ Could not check realtime publications:', error.message);
      console.log('💡 This might be normal if you don\'t have admin access');
    } else {
      console.log('📋 Tables in supabase_realtime publication:');
      if (data && data.length > 0) {
        data.forEach(row => {
          console.log(`   ✅ ${row.tablename}`);
        });
      } else {
        console.log('   ❌ No plan tables found in realtime publication');
        console.log('   💡 You may need to run: scripts/enable-plans-realtime.sql');
      }
    }
  } catch (err) {
    console.log('❌ Error checking publications:', err.message);
  }
}

async function testPlanUpdateNotification() {
  console.log('\n🧪 Testing Plan Update Notification...\n');

  const testPlanId = 'test-realtime-' + Date.now();

  try {
    console.log(`📤 Sending test notification for plan: ${testPlanId}`);

    const { data, error } = await supabase
      .from('plan_updates')
      .insert({
        plan_id: testPlanId,
        update_type: 'realtime_test',
        triggered_by: 'test-script',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          message: 'This is a test notification to verify realtime is working'
        }
      })
      .select();

    if (error) {
      console.log('❌ Failed to send test notification:', error.message);
      console.log('💡 This could mean:');
      console.log('   - plan_updates table doesn\'t exist');
      console.log('   - RLS policies are blocking the insert');
      console.log('   - You need to run the database setup scripts');
    } else {
      console.log('✅ Test notification sent successfully!');
      console.log('📡 If realtime is working, you should see this notification in your app logs');
      console.log('🔍 Look for: "📢 Processing plan update notification" in your app console');
    }
  } catch (err) {
    console.log('❌ Error sending test notification:', err.message);
  }
}

async function showSetupInstructions() {
  console.log('\n🔧 Setup Instructions:\n');

  console.log('If realtime is not working, you may need to:');
  console.log('');
  console.log('1. 📊 Set up the plans database tables:');
  console.log('   cd scripts');
  console.log('   node setup-plans-database.js');
  console.log('');
  console.log('2. 📡 Enable realtime for plans tables:');
  console.log('   - Go to: https://app.supabase.com/project/YOUR_PROJECT/sql');
  console.log('   - Run the contents of: scripts/enable-plans-realtime.sql');
  console.log('');
  console.log('3. 🔄 Restart your app to pick up the changes');
  console.log('');
  console.log('4. 🧪 Test again with this script');
}

async function main() {
  console.log('🚀 Plans Realtime Diagnostic Tool\n');
  console.log('This will help identify why plans realtime is not working.\n');

  // Check if we have valid credentials
  if (supabaseKey === 'your-anon-key-here') {
    console.log('❌ Please set your SUPABASE_ANON_KEY environment variable');
    console.log('   export SUPABASE_ANON_KEY=your_actual_key_here');
    return;
  }

  await checkRealtimeTables();
  await checkRealtimePublications();
  await testPlanUpdateNotification();
  await showSetupInstructions();

  console.log('\n✨ Done! Check your app console for realtime events.');
}

// Run the script
main().catch(console.error);
