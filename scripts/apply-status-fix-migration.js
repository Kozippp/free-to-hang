const fs = require('fs');
const path = require('path');

// Read the SQL migration file
const migrationSQL = fs.readFileSync(path.join(__dirname, 'fix-plan-status-migration.sql'), 'utf8');

console.log('🔧 Applying plan status fix migration...');
console.log('📄 Migration SQL:');
console.log(migrationSQL);
console.log('');

console.log('✅ Migration script created!');
console.log('');
console.log('📋 To apply this migration:');
console.log('1. Copy the SQL above');
console.log('2. Run it in your Supabase SQL editor or psql');
console.log('3. Or use the Supabase dashboard SQL editor');
console.log('');
console.log('This will fix the issue where normal plans don\'t appear in the Plans tab.');
console.log('After applying, normal plan creators will have status \'going\' and appear in active plans.');
