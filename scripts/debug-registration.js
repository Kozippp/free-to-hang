#!/usr/bin/env node

/**
 * Registration Debug Script for Free to Hang
 * 
 * This script helps debug the specific "Database error saving new user" issue.
 * Run with: node scripts/debug-registration.js
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Your Supabase credentials (need to be loaded from your environment or expo config)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nfzbvuyntzgszqdlsusj.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkExistingUsers(email) {
  console.log(`\n🔍 Checking if email exists: ${email}`);
  
  try {
    // Check if user exists in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, username')
      .eq('email', email);

    if (userError) {
      console.log('❌ Error checking users table:', userError.message);
      return false;
    }

    if (userData && userData.length > 0) {
      console.log('⚠️  Email already exists in users table:', userData[0]);
      return true;
    }

    console.log('✅ Email not found in users table');
    return false;

  } catch (err) {
    console.log('❌ Error:', err.message);
    return false;
  }
}

async function checkUsernameConflict(email) {
  const potentialUsername = email.split('@')[0];
  console.log(`\n🔍 Checking username conflict for: ${potentialUsername}`);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', potentialUsername);

    if (error) {
      console.log('❌ Error checking username:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      console.log('⚠️  Username already exists:', potentialUsername);
      return true;
    }

    console.log('✅ Username available:', potentialUsername);
    return false;

  } catch (err) {
    console.log('❌ Error:', err.message);
    return false;
  }
}

async function testTriggerFunction() {
  console.log('\n🔍 Testing trigger function...');
  
  try {
    // Try to call the function directly to see if it exists
    const { data, error } = await supabase.rpc('version');
    
    if (error) {
      console.log('❌ Database connection issue:', error.message);
      return false;
    }
    
    console.log('✅ Database connection working');
    return true;
    
  } catch (err) {
    console.log('❌ Database test failed:', err.message);
    return false;
  }
}

async function simulateRegistration(email, name) {
  console.log(`\n🧪 Simulating registration for: ${email}`);
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: 'TestPassword123!',
      options: {
        data: {
          name: name,
          username: email.split('@')[0]
        }
      }
    });

    if (error) {
      console.log('❌ Registration failed:', error.message);
      
      // Provide specific solutions based on error type
      if (error.message.includes('already registered')) {
        console.log('\n💡 SOLUTION: This email is already registered.');
        console.log('   Try with a different email or sign in instead.');
      } else if (error.message.includes('Database error')) {
        console.log('\n💡 SOLUTION: Database constraint violation.');
        console.log('   Check for duplicate usernames or constraint issues.');
      } else if (error.message.includes('Invalid')) {
        console.log('\n💡 SOLUTION: Invalid input data.');
        console.log('   Check email format and password requirements.');
      }
      
      return false;
    } else {
      console.log('✅ Registration successful!');
      console.log('User ID:', data.user?.id);
      console.log('Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
      
      // Clean up test user if possible
      if (data.user?.id) {
        console.log('🧹 Attempting to clean up test user...');
        // Note: This might not work with anon key
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
          console.log('✅ Test user cleaned up');
        } catch (cleanupError) {
          console.log('⚠️  Could not clean up test user (this is normal)');
        }
      }
      
      return true;
    }
    
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    return false;
  }
}

async function checkRecentActivity() {
  console.log('\n📊 Checking recent database activity...');
  
  try {
    // Check recent users
    const { data: recentUsers, error } = await supabase
      .from('users')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log('❌ Error fetching recent users:', error.message);
      return;
    }

    if (recentUsers && recentUsers.length > 0) {
      console.log('Recent users:');
      recentUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${new Date(user.created_at).toLocaleString()})`);
      });
    } else {
      console.log('No users found in database');
    }
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function main() {
  console.log('🔧 Free to Hang Registration Debugger\n');
  console.log('This will help identify why registration is failing.\n');

  // Get test email
  const email = await question('Enter the email you want to test with: ');
  const name = await question('Enter the name for testing: ');

  console.log('\n🚀 Starting diagnosis...\n');

  // Run all checks
  await checkRecentActivity();
  await checkExistingUsers(email);
  await checkUsernameConflict(email);
  await testTriggerFunction();
  await simulateRegistration(email, name);

  console.log('\n📋 Next Steps:');
  console.log('1. If email exists: Use a different email');
  console.log('2. If username conflicts: The trigger will auto-generate a unique one');
  console.log('3. If database errors: Check Supabase logs');
  console.log('4. If all green: Try registration in your app');

  rl.close();
}

// Run the script
main().catch(console.error); 