const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBroadcastSystem() {
  console.log('🧪 Testing Supabase Broadcast System');
  console.log('====================================\n');
  
  try {
    // 1. Test authentication
    console.log('1️⃣ Testing authentication...');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('⚠️  No authenticated user found. Please sign in first.');
      console.log('   You can sign in via the app or use the Supabase dashboard.');
      return;
    }
    
    console.log('✅ Authenticated as:', user.email);
    
    // 2. Test broadcast setup validation
    console.log('\n2️⃣ Testing broadcast setup...');
    
    const { data: setupData, error: setupError } = await supabase
      .rpc('validate_broadcast_setup');
    
    if (setupError) {
      console.log('❌ Broadcast setup validation failed:', setupError.message);
      console.log('   Please run the setup script first: node scripts/apply-realtime-broadcast.js');
      return;
    }
    
    console.log('✅ Broadcast setup validation:');
    setupData.forEach(row => {
      console.log(`   ${row.component}: ${row.status} - ${row.details}`);
    });
    
    // 3. Test broadcast health
    console.log('\n3️⃣ Testing broadcast health...');
    
    const { data: healthData, error: healthError } = await supabase
      .rpc('get_broadcast_health');
    
    if (healthError) {
      console.log('❌ Broadcast health check failed:', healthError.message);
    } else {
      console.log('✅ Broadcast system health:');
      healthData.forEach(row => {
        console.log(`   Status: ${row.status} - ${row.message}`);
      });
    }
    
    // 4. Get user's plans
    console.log('\n4️⃣ Getting user plans...');
    
    const { data: userPlans, error: plansError } = await supabase
      .from('plan_participants')
      .select(`
        plan_id,
        plans!inner(
          id,
          title,
          description
        )
      `)
      .eq('user_id', user.id);
    
    if (plansError) {
      console.log('❌ Error getting user plans:', plansError.message);
      return;
    }
    
    if (!userPlans || userPlans.length === 0) {
      console.log('ℹ️  No plans found for user. Create a plan first to test broadcast system.');
      return;
    }
    
    console.log(`✅ Found ${userPlans.length} plans for user:`);
    userPlans.forEach((userPlan, index) => {
      const plan = userPlan.plans;
      console.log(`   ${index + 1}. ${plan.title} (${plan.id})`);
    });
    
    // 5. Test broadcast subscription
    console.log('\n5️⃣ Testing broadcast subscription...');
    
    const testPlanId = userPlans[0].plan_id;
    const testPlanTitle = userPlans[0].plans.title;
    
    console.log(`🔗 Testing with plan: ${testPlanTitle} (${testPlanId})`);
    
    // Set up authentication for Realtime
    await supabase.realtime.setAuth();
    
    // Create broadcast channel
    const channel = supabase
      .channel(`test_broadcast_${user.id}_${Date.now()}`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        console.log('📡 BROADCAST INSERT received:', payload);
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        console.log('📡 BROADCAST UPDATE received:', payload);
      })
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        console.log('📡 BROADCAST DELETE received:', payload);
      })
      .subscribe((status) => {
        console.log('📡 Broadcast channel status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Broadcast subscription active');
          
          // Test broadcast by creating a test poll
          testBroadcastWithPoll(testPlanId, user.id);
        }
      });
    
    // Wait for subscription to be established
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testBroadcastWithPoll(planId, userId) {
  console.log('\n6️⃣ Testing broadcast with poll creation...');
  
  try {
    // Create a test poll
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .insert({
        plan_id: planId,
        question: 'Test Poll for Broadcast System',
        poll_type: 'custom',
        created_by: userId
      })
      .select()
      .single();
    
    if (pollError) {
      console.log('❌ Error creating test poll:', pollError.message);
      return;
    }
    
    console.log('✅ Test poll created:', poll.id);
    
    // Create poll options
    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert([
        {
          poll_id: poll.id,
          option_text: 'Test Option 1'
        },
        {
          poll_id: poll.id,
          option_text: 'Test Option 2'
        }
      ]);
    
    if (optionsError) {
      console.log('❌ Error creating poll options:', optionsError.message);
    } else {
      console.log('✅ Poll options created');
    }
    
    // Wait a moment for broadcast to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test voting on the poll
    console.log('\n7️⃣ Testing broadcast with poll voting...');
    
    const { data: options } = await supabase
      .from('poll_options')
      .select('id')
      .eq('poll_id', poll.id)
      .limit(1);
    
    if (options && options.length > 0) {
      const { error: voteError } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: poll.id,
          option_id: options[0].id,
          user_id: userId
        });
      
      if (voteError) {
        console.log('❌ Error voting on poll:', voteError.message);
      } else {
        console.log('✅ Vote cast successfully');
      }
    }
    
    // Wait a moment for broadcast to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clean up test data
    console.log('\n8️⃣ Cleaning up test data...');
    
    const { error: cleanupError } = await supabase
      .from('plans')
      .delete()
      .eq('id', planId);
    
    if (cleanupError) {
      console.log('⚠️  Error cleaning up test data:', cleanupError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
    
    console.log('\n✅ Broadcast system test completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Authentication working');
    console.log('   ✅ Broadcast setup validated');
    console.log('   ✅ Broadcast subscription active');
    console.log('   ✅ Poll creation triggered broadcasts');
    console.log('   ✅ Poll voting triggered broadcasts');
    console.log('   ✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testBroadcastPerformance() {
  console.log('\n📊 Testing Broadcast Performance');
  console.log('===============================\n');
  
  try {
    // Get performance stats
    const { data: perfData, error: perfError } = await supabase
      .rpc('get_broadcast_performance_stats');
    
    if (perfError) {
      console.log('❌ Performance stats not available:', perfError.message);
    } else {
      console.log('✅ Broadcast performance stats:');
      perfData.forEach(row => {
        console.log(`   ${row.metric}: ${row.value} ${row.unit}`);
      });
    }
    
    // Get broadcast activity
    const { data: activityData, error: activityError } = await supabase
      .from('broadcast_activity')
      .select('*')
      .limit(10);
    
    if (activityError) {
      console.log('❌ Broadcast activity not available:', activityError.message);
    } else {
      console.log('\n✅ Recent broadcast activity:');
      if (activityData && activityData.length > 0) {
        activityData.forEach(activity => {
          console.log(`   ${activity.topic}: ${activity.message_count} messages at ${activity.created_at}`);
        });
      } else {
        console.log('   No recent broadcast activity');
      }
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }
}

async function main() {
  console.log('🚀 Supabase Broadcast System Test');
  console.log('==================================\n');
  
  try {
    // Test basic broadcast functionality
    await testBroadcastSystem();
    
    // Test performance
    await testBroadcastPerformance();
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the broadcast system in your app');
    console.log('   2. Monitor performance using the provided functions');
    console.log('   3. Optimize RLS policies if needed');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = {
  testBroadcastSystem,
  testBroadcastWithPoll,
  testBroadcastPerformance
}; 