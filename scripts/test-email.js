#!/usr/bin/env node

/**
 * Email Testing Script for Free2Hang
 * 
 * This script helps test your email configuration directly.
 * Run with: node scripts/test-email.js
 */

const { createClient } = require('@supabase/supabase-js');

// Your Supabase credentials
const supabaseUrl = 'https://nfzbvuyntzgszqdlsusj.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmailDelivery() {
  console.log('\n🧪 Testing Email Delivery...\n');

  // Get test email from user
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const testEmail = await new Promise(resolve => {
    rl.question('Enter your email address to test: ', resolve);
  });

  console.log(`\n📧 Testing email delivery to: ${testEmail}\n`);

  try {
    // Test 1: Create a test user registration
    console.log('1️⃣ Testing user registration with email confirmation...');
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          name: 'Test User',
          username: 'testuser'
        }
      }
    });

    if (error) {
      console.error('❌ Registration failed:', error.message);
      
      // If user already exists, try resending confirmation
      if (error.message.includes('already registered')) {
        console.log('\n2️⃣ User exists, trying to resend confirmation...');
        
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: testEmail
        });

        if (resendError) {
          console.error('❌ Resend failed:', resendError.message);
        } else {
          console.log('✅ Confirmation email resent successfully!');
        }
      }
    } else {
      console.log('✅ Registration successful!');
      console.log('User ID:', data.user?.id);
      console.log('Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
    }

    console.log('\n📬 Check your email inbox now!');
    console.log('- Check main inbox');
    console.log('- Check spam/junk folder');
    console.log('- Check promotions tab (Gmail)');
    console.log('- Wait up to 5-10 minutes for delivery');

  } catch (err) {
    console.error('💥 Unexpected error:', err.message);
  }

  rl.close();
}

async function checkSupabaseConfig() {
  console.log('\n⚙️ Checking Supabase Configuration...\n');

  try {
    // Test basic connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }

    // Check auth settings
    console.log('\n📋 Manual Checks Required:');
    console.log('1. Go to: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj');
    console.log('2. Check: Authentication → Settings → SMTP Settings');
    console.log('3. Verify SMTP configuration:');
    console.log('   - Host: smtp.resend.com');
    console.log('   - Port: 587');
    console.log('   - User: resend');
    console.log('   - Pass: [Your Resend API Key]');
    console.log('   - From: info@freetohang.com');

  } catch (err) {
    console.error('💥 Configuration check failed:', err.message);
  }
}

async function main() {
  console.log('🔧 Free2Hang Email Debugging Tool\n');
  
  console.log('Choose what to test:');
  console.log('1. Test email delivery');
  console.log('2. Check Supabase configuration');
  console.log('3. Both\n');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = await new Promise(resolve => {
    rl.question('Enter your choice (1-3): ', resolve);
  });

  rl.close();

  switch (choice.trim()) {
    case '1':
      await testEmailDelivery();
      break;
    case '2':
      await checkSupabaseConfig();
      break;
    case '3':
      await checkSupabaseConfig();
      await testEmailDelivery();
      break;
    default:
      console.log('Invalid choice. Please run the script again.');
      break;
  }

  console.log('\n🔍 Additional Debugging Steps:');
  console.log('1. Check Resend dashboard: https://resend.com/emails');
  console.log('2. Verify domain status: https://resend.com/domains');
  console.log('3. Check DNS propagation: https://dnschecker.org/');
  console.log('4. Test different email providers (Gmail, Outlook, etc.)');
}

// Run the script
main().catch(console.error); 