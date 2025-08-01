const fetch = require('node-fetch');

async function testPlansAPI() {
  console.log('🧪 Testing plans API...');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch('http://localhost:3000/');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test plans endpoint without auth
    console.log('2. Testing plans endpoint without auth...');
    const plansResponse = await fetch('http://localhost:3000/api/plans');
    const plansData = await plansResponse.json();
    console.log('✅ Plans response:', plansData);

    // Test creating a plan (this will fail without auth, but we can see the error)
    console.log('3. Testing plan creation without auth...');
    const createResponse = await fetch('http://localhost:3000/api/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Plan',
        description: 'Test Description',
        location: 'Test Location',
        date: new Date().toISOString()
      })
    });
    const createData = await createResponse.json();
    console.log('✅ Create plan response:', createData);

    console.log('🎉 API test complete!');

  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

// Run the test
if (require.main === module) {
  testPlansAPI()
    .then(() => {
      console.log('✅ Test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPlansAPI }; 