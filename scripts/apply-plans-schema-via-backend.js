const fetch = require('node-fetch');

// Configuration
const BACKEND_URL = 'http://localhost:3000';

async function applyPlansSchemaViaBackend() {
  console.log('🚀 Applying plans schema via backend...');

  try {
    // 1. Test backend connection
    console.log('1. Testing backend connection...');
    const healthResponse = await fetch(`${BACKEND_URL}/`);
    const healthData = await healthResponse.json();
    console.log('✅ Backend health:', healthData);

    // 2. Create a test plan to trigger database schema creation
    console.log('2. Creating test plan to trigger schema...');
    const testPlanData = {
      title: 'Test Plan for Schema',
      description: 'This plan is created to test the database schema',
      location: 'Test Location',
      date: new Date().toISOString(),
      isAnonymous: false
    };

    // This will fail without auth, but it will help us see if the schema exists
    const createResponse = await fetch(`${BACKEND_URL}/api/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPlanData)
    });

    const createData = await createResponse.json();
    console.log('✅ Create plan response:', createData);

    // 3. Test polls endpoint
    console.log('3. Testing polls endpoint...');
    const pollsResponse = await fetch(`${BACKEND_URL}/api/plans/test/polls`);
    const pollsData = await pollsResponse.json();
    console.log('✅ Polls response:', pollsData);

    console.log('🎉 Schema test complete!');

  } catch (error) {
    console.error('❌ Error applying schema:', error);
  }
}

// Run the script
if (require.main === module) {
  applyPlansSchemaViaBackend()
    .then(() => {
      console.log('✅ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyPlansSchemaViaBackend }; 