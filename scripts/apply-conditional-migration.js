require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyConditionalMigration() {
  console.log('🔧 Applying conditional update types migration...');
  
  try {
    // First, drop the existing constraint
    console.log('1. Dropping existing constraint...');
    const { error: dropError } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE plan_updates DROP CONSTRAINT IF EXISTS plan_updates_update_type_check;'
    });
    
    if (dropError) {
      console.error('❌ Error dropping constraint:', dropError);
      throw dropError;
    }
    
    console.log('✅ Constraint dropped successfully');
    
    // Add the new constraint with conditional types
    console.log('2. Adding new constraint with conditional types...');
    const { error: addError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE plan_updates ADD CONSTRAINT plan_updates_update_type_check 
        CHECK (update_type IN (
          'poll_created', 
          'poll_voted', 
          'poll_won', 
          'participant_joined', 
          'participant_left', 
          'participant_conditional',
          'participant_accepted_conditionally',
          'plan_completed', 
          'new_message'
        ));
      `
    });
    
    if (addError) {
      console.error('❌ Error adding new constraint:', addError);
      throw addError;
    }
    
    console.log('✅ New constraint added successfully');
    
    // Add performance index
    console.log('3. Adding performance index...');
    const { error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_plan_updates_conditional 
        ON plan_updates(plan_id, update_type) 
        WHERE update_type = 'participant_conditional';
      `
    });
    
    if (indexError) {
      console.error('❌ Error adding index:', indexError);
      throw indexError;
    }
    
    console.log('✅ Performance index added successfully');
    
    // Test the constraint by inserting a test record
    console.log('4. Testing constraint with test record...');
    const { error: testError } = await supabase
      .from('plan_updates')
      .insert({
        plan_id: '00000000-0000-0000-0000-000000000000', // Dummy plan ID
        update_type: 'participant_conditional',
        triggered_by: '00000000-0000-0000-0000-000000000000', // Dummy user ID
        metadata: { test: true }
      })
      .select();
    
    if (testError && !testError.message.includes('violates foreign key')) {
      // Foreign key error is expected since we're using dummy IDs
      console.error('❌ Error testing constraint:', testError);
      throw testError;
    }
    
    // Clean up test record if it was inserted
    await supabase
      .from('plan_updates')
      .delete()
      .eq('plan_id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✅ Constraint test passed');
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyConditionalMigration(); 