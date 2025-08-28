const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

console.log('🔍 Debugging plan participant status...\n');

// Resolve environment variables based on active project (same as backend)
const ACTIVE = process.env.SUPABASE_ACTIVE_PROJECT || 'EBPW';
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];

const supabaseUrl = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
const supabaseServiceKey = resolveEnv(`SUPABASE_SERVICE_ROLE_KEY_${ACTIVE}`, 'SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugPlanStatus() {
  try {
    console.log('📋 Checking plan_participants table...\n');

    // Try to query the table directly to check if it exists
    const { data: testData, error: tableError } = await supabase
      .from('plan_participants')
      .select('status')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing plan_participants table:', tableError.message);
      console.log('💡 The table might not exist or there might be permissions issues.');
      console.log('💡 Please run the main schema setup first.');
      return;
    }

    console.log('✅ Table plan_participants exists\n');

    // Check current status values
    const { data: allParticipants, error: statusError } = await supabase
      .from('plan_participants')
      .select('status');

    if (statusError) {
      console.error('❌ Error getting status data:', statusError);
    } else {
      const statusMap = {};
      allParticipants.forEach(row => {
        statusMap[row.status] = (statusMap[row.status] || 0) + 1;
      });

      console.log('📊 Current status distribution:');
      Object.entries(statusMap).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      console.log('');
    }

    // Show the migration SQL
    console.log('📄 Migration SQL to apply:');
    console.log('='.repeat(50));

    const migrationSQL = fs.readFileSync(path.join(__dirname, 'fix-plan-status-migration.sql'), 'utf8');
    console.log(migrationSQL);

    console.log('='.repeat(50));
    console.log('');
    console.log('📋 Instructions:');
    console.log('1. Copy the SQL above');
    console.log('2. Go to your Supabase dashboard');
    console.log('3. Navigate to SQL Editor');
    console.log('4. Paste and run the SQL');
    console.log('');
    console.log('This will fix the status column to use "going" instead of "accepted"');

  } catch (error) {
    console.error('❌ Error in debug script:', error);
  }
}

debugPlanStatus();
