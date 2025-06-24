const { createClient } = require('@supabase/supabase-js');

// Environment configuration (use your actual values)
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusl.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  console.log('Please run: export EXPO_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"');
  process.exit(1);
}

async function testAuthentication() {
  try {
    console.log('🔍 Testing JWT Authentication...');
    console.log('📍 Supabase URL:', supabaseUrl);
    console.log('🔑 Anon Key configured:', supabaseAnonKey ? 'Yes' : 'No');
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test sign in with your email
    console.log('\n📧 Signing in with mihkelkoobi@gmail.com...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithOtp({
      email: 'mihkelkoobi@gmail.com',
      options: {
        shouldCreateUser: false
      }
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }
    
    console.log('✅ OTP sent successfully');
    console.log('📱 Please check your email and enter the OTP when prompted');
    
    // Wait for user input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const otp = await new Promise((resolve) => {
      rl.question('Enter the OTP from your email: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    
    console.log('\n🔐 Verifying OTP...');
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: 'mihkelkoobi@gmail.com',
      token: otp,
      type: 'email'
    });
    
    if (verifyError) {
      console.error('❌ OTP verification failed:', verifyError.message);
      return;
    }
    
    console.log('✅ OTP verified successfully');
    console.log('👤 User:', verifyData.user.email);
    
    // Get the session and token
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.error('❌ No session found after verification');
      return;
    }
    
    const token = sessionData.session.access_token;
    console.log('🔑 JWT Token preview:', token.substring(0, 50) + '...');
    
    // Test the token with the backend
    console.log('\n🌐 Testing token with backend...');
    const response = await fetch('https://free-to-hang-production.up.railway.app/api/plans?status=all', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    const responseData = await response.json();
    console.log('📄 Response data:', JSON.stringify(responseData, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Authentication successful!');
    } else {
      console.log('❌ Authentication failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuthentication(); 