-- Demo data for Free to Hang app
-- This script creates sample users and friendships for testing

-- First, create some demo users (these would normally be created via auth.users, but we'll simulate them)
-- Note: In production, these would be created through the normal registration process

-- Sample user data to insert after real users are created
-- User 1: John (will have many friends)
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000001',
  'john@demo.com',
  'John Smith',
  'johnsmith',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
  'Always up for coffee or a quick adventure! 🎯'
);

-- User 2: Sarah
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000002',
  'sarah@demo.com',
  'Sarah Johnson',
  'sarahj',
  'https://images.unsplash.com/photo-1494790108755-2616b612b587?w=120&h=120&fit=crop&crop=face',
  'Love meeting new people and trying new restaurants! 🍕'
);

-- User 3: Mike
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000003',
  'mike@demo.com',
  'Mike Chen',
  'mikechen',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
  'Photographer and weekend hiker 📸🥾'
);

-- User 4: Emma
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000004',
  'emma@demo.com',
  'Emma Wilson',
  'emmaw',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=face',
  'Yoga instructor and coffee enthusiast ☕🧘‍♀️'
);

-- User 5: Alex
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000005',
  'alex@demo.com',
  'Alex Rodriguez',
  'alexr',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
  'Software developer who loves board games 🎲💻'
);

-- User 6: Lisa
INSERT INTO users (id, email, name, username, avatar_url, bio) VALUES 
(
  '00000000-0000-0000-0000-000000000006',
  'lisa@demo.com',
  'Lisa Brown',
  'lisab',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=face',
  'Art student and weekend market explorer 🎨🛍️'
);

-- Create user status records for all demo users
INSERT INTO user_status (user_id, is_available, activity, last_seen) VALUES 
('00000000-0000-0000-0000-000000000001', true, 'Free for coffee or a walk', NOW()),
('00000000-0000-0000-0000-000000000002', true, 'Looking for brunch buddies', NOW()),
('00000000-0000-0000-0000-000000000003', false, '', NOW() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000004', true, 'Up for yoga or a chat', NOW()),
('00000000-0000-0000-0000-000000000005', false, '', NOW() - INTERVAL '30 minutes'),
('00000000-0000-0000-0000-000000000006', true, 'Want to check out the new gallery', NOW());

-- Create friendships (bidirectional)
-- John's friends (he'll be the main demo account)
INSERT INTO friends (user_id, friend_id, status, share_availability) VALUES 
-- John -> others
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'accepted', 'week'),

-- Others -> John (reciprocal friendships)
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'accepted', 'week'),

-- Some cross-friendships between others
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'accepted', 'week'),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'accepted', 'week');

-- Create some sample plans
INSERT INTO plans (id, creator_id, title, description, location, date, max_participants, status) VALUES 
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Coffee at Central Perk',
  'Anyone want to grab coffee this afternoon? I found this new cafe with amazing pastries!',
  'Central Perk Cafe, Downtown',
  NOW() + INTERVAL '3 hours',
  4,
  'active'
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'Weekend Hiking Trip',
  'Planning a hike this weekend. Beautiful weather forecast!',
  'Green Mountain Trail',
  NOW() + INTERVAL '2 days',
  6,
  'active'
);

-- Add participants to plans
INSERT INTO plan_participants (plan_id, user_id, response) VALUES 
-- Coffee plan participants
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'accepted'), -- John (creator)
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'accepted'), -- Sarah
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'maybe'),    -- Emma

-- Hiking plan participants  
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'accepted'), -- Sarah (creator)
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'accepted'), -- John
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'pending'),  -- Mike
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'declined'); -- Alex

-- Instructions for testing:
-- 1. Create a real account via the app (this will get a real auth.users entry)
-- 2. To test as John (with many friends), manually update your user record:
--    UPDATE users SET id = '00000000-0000-0000-0000-000000000001' WHERE email = 'your_real_email@example.com';
-- 3. Then you'll see all the demo friends and can test multi-user functionality 