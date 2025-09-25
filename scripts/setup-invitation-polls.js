const fs = require('fs');
const path = require('path');

function setupInvitationPolls() {
  console.log('🚀 Setting up Invitation Poll Tables');
  console.log('=====================================\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'create-invitation-poll-tables.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('--- COPY THIS SQL TO SUPABASE SQL EDITOR ---');
    console.log(schema);
    console.log('--- END OF SQL ---');
    console.log('');
    console.log('🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
    console.log('');
    console.log('✅ This will create:');
    console.log('  - invitation_polls table');
    console.log('  - invitation_poll_votes table');
    console.log('  - process_expired_invitation_polls() function');
    console.log('  - RLS policies and indexes');
    console.log('  - Realtime subscriptions');

  } catch (error) {
    console.error('❌ Error reading schema file:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupInvitationPolls();
}
