# Database Setup Instructions

## Supabase Dashboard Setup

1. **Go to your Supabase dashboard**: https://app.supabase.com/project/nfzbvuyntzgszqdlsusj
2. **Navigate to SQL Editor** (left sidebar)
3. **Click "New Query"**
4. **Copy and paste the following SQL code**:

```sql
-- Enable RLS for all tables
ALTER DATABASE postgres SET timezone TO 'UTC';

-- Create users table with RLS
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own profile
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Create user_status table
CREATE TABLE IF NOT EXISTS user_status (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    is_available BOOLEAN DEFAULT FALSE,
    activity TEXT DEFAULT '',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_status
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Status policies
CREATE POLICY "Users can manage their own status" ON user_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view friends status" ON user_status FOR SELECT USING (
    auth.uid() IN (
        SELECT CASE 
            WHEN f.user_id = user_id THEN f.friend_id 
            WHEN f.friend_id = user_id THEN f.user_id 
        END
        FROM friends f 
        WHERE f.status = 'accepted' 
        AND (f.user_id = user_id OR f.friend_id = user_id)
    )
);

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    share_availability TEXT DEFAULT 'week' CHECK (share_availability IN ('never', 'today', 'week', 'forever')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Enable RLS on friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Friends policies
CREATE POLICY "Users can manage their friendships" ON friends FOR ALL USING (
    auth.uid() = user_id OR auth.uid() = friend_id
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    max_participants INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "Users can view plans they're involved in" ON plans FOR SELECT USING (
    auth.uid() = creator_id OR 
    auth.uid() IN (SELECT user_id FROM plan_participants WHERE plan_id = id)
);
CREATE POLICY "Users can create plans" ON plans FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their plans" ON plans FOR UPDATE USING (auth.uid() = creator_id);

-- Create plan_participants table
CREATE TABLE IF NOT EXISTS plan_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    response TEXT DEFAULT 'pending' CHECK (response IN ('accepted', 'maybe', 'declined', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_id, user_id)
);

-- Enable RLS on plan_participants
ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;

-- Plan participants policies
CREATE POLICY "Users can manage their participation" ON plan_participants FOR ALL USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT creator_id FROM plans WHERE id = plan_id)
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, name, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
    );
    
    INSERT INTO user_status (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
```

5. **Click "Run" button** to execute the SQL
6. **Verify tables were created** by going to "Table Editor" in the left sidebar

## After Setup

Once you've run the SQL in Supabase dashboard, your app should work properly without the "Network request failed" errors. 