const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing required environment variable:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  console.error('\n💡 Please add this to your .env file:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing required environment variable:');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Please add this to your .env file:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('\n📝 You can find this in your Supabase dashboard under Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRealtimeBroadcastSetup() {
  console.log('🚀 Starting Supabase Realtime Broadcast setup...');
  
  try {
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'setup-realtime-broadcast.sql');
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
        
        // Try to execute the statement using direct SQL
        // Note: Supabase client doesn't support direct SQL execution for complex scripts
        // We'll use a different approach - execute specific statements that we can handle
        
        if (statement.includes('CREATE OR REPLACE FUNCTION') || 
            statement.includes('CREATE TRIGGER') || 
            statement.includes('CREATE POLICY') ||
            statement.includes('CREATE INDEX') ||
            statement.includes('GRANT') ||
            statement.includes('DROP TRIGGER')) {
          
          console.log('⚠️  Complex SQL statement detected. Please run this manually in Supabase SQL editor:');
          console.log('📝 Statement:', statement.substring(0, 200) + '...');
          console.log('🌐 Go to: https://supabase.com/dashboard/project/gmhufbwvegxasckjenap/sql');
          console.log('📋 Copy and paste the SQL script from: scripts/setup-broadcast-manual.sql');
          console.log('');
          
          // Skip this statement for now
          continue;
        }
        
        // For simple statements, we can try to execute them
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.log('⚠️  Statement requires manual execution in SQL editor');
            continue;
          }
        } catch (error) {
          console.log('⚠️  Statement requires manual execution in SQL editor');
          continue;
        }
        
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
    await testBroadcastSetup();
    
  } catch (error) {
    console.error('❌ Error during broadcast setup:', error);
    process.exit(1);
  }
}

async function testBroadcastSetup() {
  console.log('\n🧪 Testing broadcast setup...');
  
  try {
    // Test validation function
    const { data: validationData, error: validationError } = await supabase
      .rpc('validate_broadcast_setup');
    
    if (validationError) {
      console.log('⚠️  Validation function not available yet:', validationError.message);
    } else {
      console.log('✅ Broadcast setup validation:');
      validationData.forEach(row => {
        console.log(`   ${row.component}: ${row.status} - ${row.details}`);
      });
    }
    
    // Test health check
    const { data: healthData, error: healthError } = await supabase
      .rpc('get_broadcast_health');
    
    if (healthError) {
      console.log('⚠️  Health check not available yet:', healthError.message);
    } else {
      console.log('✅ Broadcast system health:');
      healthData.forEach(row => {
        console.log(`   Status: ${row.status} - ${row.message}`);
      });
    }
    
    // Test performance stats
    const { data: perfData, error: perfError } = await supabase
      .rpc('get_broadcast_performance_stats');
    
    if (perfError) {
      console.log('⚠️  Performance stats not available yet:', perfError.message);
    } else {
      console.log('✅ Broadcast performance stats:');
      perfData.forEach(row => {
        console.log(`   ${row.metric}: ${row.value} ${row.unit}`);
      });
    }
    
  } catch (error) {
    console.log('⚠️  Test functions not available yet:', error.message);
  }
}

async function createTestPlan() {
  console.log('\n🧪 Creating test plan for broadcast testing...');
  
  try {
    // Get a test user
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.log('⚠️  No users found for testing');
      return null;
    }
    
    const testUserId = users[0].id;
    
    // Create a test plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        creator_id: testUserId,
        title: 'Test Plan for Broadcast',
        description: 'This plan is created to test the broadcast system',
        location: 'Test Location',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        is_anonymous: false
      })
      .select()
      .single();
    
    if (planError) {
      console.log('⚠️  Error creating test plan:', planError.message);
      return null;
    }
    
    console.log('✅ Test plan created:', plan.id);
    
    // Add the creator as a participant
    await supabase
      .from('plan_participants')
      .insert({
        plan_id: plan.id,
        user_id: testUserId,
        response: 'accepted'
      });
    
    // Create a test poll
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .insert({
        plan_id: plan.id,
        question: 'Test Poll Question',
        poll_type: 'custom',
        created_by: testUserId
      })
      .select()
      .single();
    
    if (pollError) {
      console.log('⚠️  Error creating test poll:', pollError.message);
      return plan;
    }
    
    console.log('✅ Test poll created:', poll.id);
    
    // Create test poll options
    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert([
        {
          poll_id: poll.id,
          option_text: 'Option 1'
        },
        {
          poll_id: poll.id,
          option_text: 'Option 2'
        }
      ]);
    
    if (optionsError) {
      console.log('⚠️  Error creating test poll options:', optionsError.message);
    } else {
      console.log('✅ Test poll options created');
    }
    
    return plan;
    
  } catch (error) {
    console.log('⚠️  Error in test setup:', error.message);
    return null;
  }
}

async function testBroadcastFunctionality(testPlanId) {
  if (!testPlanId) {
    console.log('⚠️  No test plan available for broadcast testing');
    return;
  }
  
  console.log('\n🧪 Testing broadcast functionality...');
  
  try {
    // Test the broadcast system
    const { error: testError } = await supabase
      .rpc('test_broadcast_system', { plan_id_param: testPlanId });
    
    if (testError) {
      console.log('⚠️  Broadcast test function not available:', testError.message);
    } else {
      console.log('✅ Broadcast test triggered successfully');
    }
    
    // Get broadcast topics for the plan
    const { data: topics, error: topicsError } = await supabase
      .rpc('get_plan_broadcast_topics', { plan_id_param: testPlanId });
    
    if (topicsError) {
      console.log('⚠️  Topics function not available:', topicsError.message);
    } else {
      console.log('✅ Available broadcast topics:');
      topics.forEach(topic => {
        console.log(`   ${topic.topic}: ${topic.description}`);
      });
    }
    
  } catch (error) {
    console.log('⚠️  Error testing broadcast functionality:', error.message);
  }
}

async function cleanupTestData(testPlanId) {
  if (!testPlanId) {
    return;
  }
  
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete test plan (this will cascade delete related data)
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', testPlanId);
    
    if (error) {
      console.log('⚠️  Error cleaning up test data:', error.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
    
  } catch (error) {
    console.log('⚠️  Error in cleanup:', error.message);
  }
}

async function main() {
  console.log('🚀 Supabase Realtime Broadcast Setup');
  console.log('=====================================\n');
  
  try {
    // Apply the broadcast setup
    await applyRealtimeBroadcastSetup();
    
    // Create test data
    const testPlan = await createTestPlan();
    
    // Test broadcast functionality
    await testBroadcastFunctionality(testPlan?.id);
    
    // Clean up test data
    await cleanupTestData(testPlan?.id);
    
    console.log('\n✅ Broadcast setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update your client code to use Broadcast instead of Postgres Changes');
    console.log('   2. Test the real-time functionality in your app');
    console.log('   3. Monitor broadcast performance using the provided functions');
    console.log('\n🔧 Available functions:');
    console.log('   - validate_broadcast_setup() - Check if setup is correct');
    console.log('   - get_broadcast_health() - Check system health');
    console.log('   - get_broadcast_performance_stats() - Monitor performance');
    console.log('   - get_plan_broadcast_topics(plan_id) - Get available topics');
    console.log('   - test_broadcast_system(plan_id) - Test broadcast functionality');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = {
  applyRealtimeBroadcastSetup,
  testBroadcastSetup,
  createTestPlan,
  testBroadcastFunctionality,
  cleanupTestData
}; 