#!/usr/bin/env node

/**
 * Email Setup Script for Free2Hang
 * 
 * This script helps you configure email settings for your Supabase project.
 * Run with: node scripts/setup-email.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 Free2Hang Email Setup Assistant\n');
  console.log('This script will guide you through setting up emails for your app.\n');

  // Get email provider choice
  console.log('Choose your email provider:');
  console.log('1. SendGrid (Recommended for apps)');
  console.log('2. Google Workspace');
  console.log('3. Other SMTP provider\n');

  const choice = await question('Enter your choice (1-3): ');

  switch (choice.trim()) {
    case '1':
      await setupSendGrid();
      break;
    case '2':
      await setupGoogleWorkspace();
      break;
    case '3':
      await setupCustomSMTP();
      break;
    default:
      console.log('Invalid choice. Please run the script again.');
      break;
  }

  rl.close();
}

async function setupSendGrid() {
  console.log('\n📧 SendGrid Setup\n');
  
  console.log('Step 1: Create SendGrid Account');
  console.log('- Go to: https://sendgrid.com/');
  console.log('- Sign up for free account (100 emails/day)');
  console.log('- Verify your account\n');

  await question('Press Enter when you have created your SendGrid account...');

  console.log('Step 2: Domain Authentication');
  console.log('- In SendGrid dashboard: Settings → Sender Authentication');
  console.log('- Click "Authenticate Your Domain"');
  console.log('- Enter domain: freetohang.com');
  console.log('- Choose "Yes" for branded links');
  console.log('- Add the DNS records to your domain provider\n');

  await question('Press Enter when you have added DNS records...');

  console.log('Step 3: Create API Key');
  console.log('- Go to: Settings → API Keys');
  console.log('- Click "Create API Key"');
  console.log('- Choose "Restricted Access"');
  console.log('- Give permissions: Mail Send, Marketing Campaigns');
  console.log('- Copy the API Key\n');

  const apiKey = await question('Paste your SendGrid API Key here: ');

  console.log('\n✅ Configuration for Supabase:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Go to your Supabase dashboard:');
  console.log('https://app.supabase.com/project/nfzbvuyntzgszqdlsusj');
  console.log('\nNavigation: Authentication → Settings → SMTP Settings');
  console.log('\nEnter these values:');
  console.log(`SMTP Host: smtp.sendgrid.net`);
  console.log(`SMTP Port: 587`);
  console.log(`SMTP User: apikey`);
  console.log(`SMTP Pass: ${apiKey}`);
  console.log(`SMTP From: info@freetohang.com`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🎉 SendGrid setup complete!');
  console.log('Test by registering a new user in your app.');
}

async function setupGoogleWorkspace() {
  console.log('\n📧 Google Workspace Setup\n');
  
  console.log('Step 1: Google Workspace Account');
  console.log('- Go to: https://workspace.google.com/');
  console.log('- Start free trial');
  console.log('- Enter domain: freetohang.com');
  console.log('- Follow verification steps\n');

  await question('Press Enter when you have set up Google Workspace...');

  console.log('Step 2: Create Email Account');
  console.log('- In Google Admin Console');
  console.log('- Add user: info@freetohang.com');
  console.log('- Set strong password\n');

  const email = 'info@freetohang.com';
  const password = await question('Enter the password for info@freetohang.com: ');

  console.log('\nStep 3: Enable 2-Step Verification and App Password');
  console.log('- Sign in to info@freetohang.com');
  console.log('- Go to: Google Account → Security');
  console.log('- Enable 2-Step Verification');
  console.log('- Create App Password for "Mail"\n');

  const appPassword = await question('Enter the App Password: ');

  console.log('\n✅ Configuration for Supabase:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Go to your Supabase dashboard:');
  console.log('https://app.supabase.com/project/nfzbvuyntzgszqdlsusj');
  console.log('\nNavigation: Authentication → Settings → SMTP Settings');
  console.log('\nEnter these values:');
  console.log(`SMTP Host: smtp.gmail.com`);
  console.log(`SMTP Port: 587`);
  console.log(`SMTP User: ${email}`);
  console.log(`SMTP Pass: ${appPassword}`);
  console.log(`SMTP From: ${email}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🎉 Google Workspace setup complete!');
}

async function setupCustomSMTP() {
  console.log('\n📧 Custom SMTP Setup\n');
  
  const host = await question('SMTP Host: ');
  const port = await question('SMTP Port (usually 587): ');
  const user = await question('SMTP Username: ');
  const pass = await question('SMTP Password: ');
  const from = await question('From Email (info@freetohang.com): ');

  console.log('\n✅ Configuration for Supabase:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Go to your Supabase dashboard:');
  console.log('https://app.supabase.com/project/nfzbvuyntzgszqdlsusj');
  console.log('\nNavigation: Authentication → Settings → SMTP Settings');
  console.log('\nEnter these values:');
  console.log(`SMTP Host: ${host}`);
  console.log(`SMTP Port: ${port}`);
  console.log(`SMTP User: ${user}`);
  console.log(`SMTP Pass: ${pass}`);
  console.log(`SMTP From: ${from || 'info@freetohang.com'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🎉 Custom SMTP setup complete!');
}

// Run the script
main().catch(console.error); 