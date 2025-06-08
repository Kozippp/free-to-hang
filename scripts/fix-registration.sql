-- Complete fix for registration issues
-- Run this in Supabase SQL Editor

-- First, drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate the function with proper error handling and unique username generation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_username TEXT;
    username_counter INTEGER := 0;
    base_username TEXT;
BEGIN
    -- Get base username from email
    base_username := split_part(NEW.email, '@', 1);
    new_username := COALESCE(NEW.raw_user_meta_data->>'username', base_username);
    
    -- Ensure username is unique
    WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username) LOOP
        username_counter := username_counter + 1;
        new_username := base_username || username_counter::text;
    END LOOP;

    -- Insert into users table
    INSERT INTO users (id, email, name, username, avatar_url, bio)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', base_username),
        new_username,
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'bio'
    );
    
    -- Insert into user_status table
    INSERT INTO user_status (user_id, is_available, activity)
    VALUES (NEW.id, false, '');
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging
        RAISE LOG 'Error in handle_new_user for user %: %', NEW.email, SQLERRM;
        -- Re-raise the exception so it bubbles up
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Fix RLS policies for users table
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile" ON users 
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix RLS policies for user_status table  
DROP POLICY IF EXISTS "Users can manage their own status" ON user_status;
CREATE POLICY "Users can manage their own status" ON user_status 
    FOR ALL USING (auth.uid() = user_id);

-- Ensure proper permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Test the function (optional)
SELECT 'Function created successfully' as status; 