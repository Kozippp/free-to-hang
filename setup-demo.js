const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ydize8.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkaXplOCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MzU0NzE5NzQsImV4cCI6MjA1MTA0Nzk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDemoData() {
  console.log('Setting up demo data...');
  
  try {
    // Read and execute the demo data SQL
    const fs = require('fs');
    const sql = fs.readFileSync('./supabase/demo-data.sql', 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error setting up demo data:', error);
    } else {
      console.log('Demo data setup complete!');
      console.log('Demo users created:');
      console.log('- John Smith (john@demo.com) - has 5 friends');
      console.log('- Sarah Johnson (sarah@demo.com)');
      console.log('- Mike Chen (mike@demo.com)');
      console.log('- Emma Wilson (emma@demo.com)');
      console.log('- Alex Rodriguez (alex@demo.com)');
      console.log('- Lisa Brown (lisa@demo.com)');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

setupDemoData(); 