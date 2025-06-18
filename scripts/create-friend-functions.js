const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

console.log('📋 Please apply the following SQL functions manually in your Supabase dashboard:');
console.log('');

console.log('-- Function 1: Get friendship status between two users');
console.log(`
CREATE OR REPLACE FUNCTION get_friendship_status(user1_id UUID, user2_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_record friend_requests%ROWTYPE;
BEGIN
    -- Check if there's a request from user1 to user2
    SELECT * INTO request_record
    FROM friend_requests
    WHERE sender_id = user1_id AND receiver_id = user2_id;
    
    IF FOUND THEN
        RETURN request_record.status || '_sent';
    END IF;
    
    -- Check if there's a request from user2 to user1
    SELECT * INTO request_record
    FROM friend_requests
    WHERE sender_id = user2_id AND receiver_id = user1_id;
    
    IF FOUND THEN
        RETURN request_record.status || '_received';
    END IF;
    
    -- No relationship found
    RETURN 'none';
END;
$$;
`);

console.log('-- Function 2: Get all friends for a user');
console.log(`
CREATE OR REPLACE FUNCTION get_user_friends(user_id UUID)
RETURNS TABLE(
    friend_id UUID,
    friend_name TEXT,
    friend_username TEXT,
    friend_avatar_url TEXT,
    friend_vibe TEXT,
    friendship_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Friends where user is sender
    SELECT 
        u.id as friend_id,
        u.name as friend_name,
        u.username as friend_username,
        u.avatar_url as friend_avatar_url,
        u.vibe as friend_vibe,
        fr.updated_at as friendship_date
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = user_id AND fr.status = 'accepted'
    
    UNION
    
    -- Friends where user is receiver
    SELECT 
        u.id as friend_id,
        u.name as friend_name,
        u.username as friend_username,
        u.avatar_url as friend_avatar_url,
        u.vibe as friend_vibe,
        fr.updated_at as friendship_date
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = user_id AND fr.status = 'accepted'
    
    ORDER BY friendship_date DESC;
END;
$$;
`);

console.log('-- Function 3: Get incoming friend requests');
console.log(`
CREATE OR REPLACE FUNCTION get_incoming_requests(user_id UUID)
RETURNS TABLE(
    request_id UUID,
    sender_id UUID,
    sender_name TEXT,
    sender_username TEXT,
    sender_avatar_url TEXT,
    sender_vibe TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id as request_id,
        u.id as sender_id,
        u.name as sender_name,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url,
        u.vibe as sender_vibe,
        fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = user_id AND fr.status = 'pending'
    ORDER BY fr.created_at DESC;
END;
$$;
`);

console.log('-- Function 4: Get outgoing friend requests');
console.log(`
CREATE OR REPLACE FUNCTION get_outgoing_requests(user_id UUID)
RETURNS TABLE(
    request_id UUID,
    receiver_id UUID,
    receiver_name TEXT,
    receiver_username TEXT,
    receiver_avatar_url TEXT,
    receiver_vibe TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id as request_id,
        u.id as receiver_id,
        u.name as receiver_name,
        u.username as receiver_username,
        u.avatar_url as receiver_avatar_url,
        u.vibe as receiver_vibe,
        fr.created_at
    FROM friend_requests fr
    JOIN users u ON u.id = fr.receiver_id
    WHERE fr.sender_id = user_id AND fr.status = 'pending'
    ORDER BY fr.created_at DESC;
END;
$$;
`);

console.log('');
console.log('📝 Instructions:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste each function above');
console.log('4. Run each function one by one');
console.log('5. Your friend system database is now ready!');
console.log('');
console.log('🚀 Next steps:');
console.log('1. Start the backend server: cd backend && npm start');
console.log('2. Start the frontend: npx expo start --clear --tunnel');
console.log('3. Test the friend system in the app!');

console.log('');
console.log('✅ Friend system setup complete!'); 