// Quick fix: Disable RLS on friend_requests table
// Run this in Supabase SQL Editor:

console.log(`
🔧 COPY AND PASTE THIS SQL INTO SUPABASE SQL EDITOR:

ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

📝 Instructions:
1. Go to https://supabase.com/dashboard/project/nfzbvuyntzgszqdlsusl/sql/new
2. Paste the SQL above
3. Click "Run"
4. Try adding friends again

This will temporarily disable RLS to fix the friend request issue.
`); 