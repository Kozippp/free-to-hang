const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

// Respect active project selection
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];

const SUPABASE_URL = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = resolveEnv(`SUPABASE_SERVICE_ROLE_KEY_${ACTIVE}`, 'SUPABASE_SERVICE_ROLE_KEY');

// Create Supabase client with service role for background tasks
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

class PlanScheduler {
  constructor() {
    this.isRunning = false;
    this.tasks = [];
  }

  start() {
    if (this.isRunning) {
      console.log('🔄 Plan scheduler is already running');
      return;
    }

    console.log('🚀 Starting plan scheduler...');
    this.isRunning = true;

    // Schedule auto-completion every 5 minutes (instead of every minute for performance)
    this.scheduleAutoCompletion();

    // Schedule conditional status reevaluation every 2 minutes
    this.scheduleConditionalReevaluation();

    console.log('✅ Plan scheduler started successfully');
  }

  stop() {
    console.log('🛑 Stopping plan scheduler...');
    this.tasks.forEach(task => task.destroy());
    this.tasks = [];
    this.isRunning = false;
    console.log('✅ Plan scheduler stopped');
  }

  // Auto-complete plans after 24 hours
  scheduleAutoCompletion() {
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('⏰ Running auto-completion check...');

        // Call the database function to auto-complete plans
        const { data, error } = await supabase.rpc('auto_complete_plans');

        if (error) {
          console.error('❌ Error auto-completing plans:', error);
        } else {
          console.log('✅ Auto-completion check completed');
        }

        // Get newly completed plans and notify
        const { data: completedPlans, error: fetchError } = await supabase
          .from('plans')
          .select('id, title, creator_id')
          .eq('status', 'completed')
          .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

        if (!fetchError && completedPlans && completedPlans.length > 0) {
          for (const plan of completedPlans) {
            // Create plan update notification
            await supabase
              .from('plan_updates')
              .insert({
                plan_id: plan.id,
                update_type: 'plan_completed',
                triggered_by: null,
                metadata: { auto_completed: true }
              });

            console.log(`📋 Auto-completed plan: ${plan.title} (${plan.id})`);
          }
        }
      } catch (error) {
        console.error('❌ Auto-completion task failed:', error);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    task.start();
    this.tasks.push(task);
  }


  // Reevaluate conditional statuses (Node implementation, no DB RPC)
  scheduleConditionalReevaluation() {
    const task = cron.schedule('*/2 * * * *', async () => {
      try {
        console.log('🔄 Checking conditional statuses...');

        // Get all plans that potentially have conditional participants (stored as 'maybe')
        const { data: conditionalParticipants, error } = await supabase
          .from('plan_participants')
          .select('plan_id')
          .eq('status', 'maybe');

        if (error) {
          console.error('❌ Error fetching conditional participants:', error);
          return;
        }

        if (!conditionalParticipants || conditionalParticipants.length === 0) {
          return;
        }

        // Get unique plan ids
        const planIds = [...new Set(conditionalParticipants.map(cp => cp.plan_id))];

        // Process each plan using the same TS logic as in the route
        for (const planId of planIds) {
          try {
            // Dynamically import the plans router to access the helper
            const plansRouter = require('../routes/plans');
            if (typeof plansRouter.processConditionalDependencies === 'function') {
              await plansRouter.processConditionalDependencies(planId);
              console.log(`✅ Processed conditional dependencies for plan ${planId}`);
            }
          } catch (planError) {
            console.error(`❌ Exception processing plan ${planId}:`, planError);
          }
        }
      } catch (error) {
        console.error('❌ Conditional reevaluation task failed:', error);
      }
    }, {
      scheduled: false
    });

    task.start();
    this.tasks.push(task);
  }

  // Manual trigger methods for testing
  async triggerAutoCompletion() {
    console.log('🔧 Manually triggering auto-completion...');
    const { data, error } = await supabase.rpc('auto_complete_plans');
    if (error) {
      console.error('❌ Manual auto-completion failed:', error);
      return false;
    }
    console.log('✅ Manual auto-completion completed');
    return true;
  }

}

// Export singleton instance
const scheduler = new PlanScheduler();
module.exports = scheduler;
