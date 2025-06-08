-- Add onboarding_completed field to users table
-- Run this in Supabase SQL Editor

-- Add the onboarding_completed column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add interests column to store user's hangout preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;

-- Update existing users to have onboarding_completed = false
UPDATE users SET onboarding_completed = FALSE WHERE onboarding_completed IS NULL;

-- Update the handle_new_user function to include onboarding_completed
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

    -- Insert into users table with onboarding_completed = false
    INSERT INTO users (id, email, name, username, avatar_url, bio, onboarding_completed)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', base_username),
        new_username,
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'bio',
        FALSE
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

SELECT 'Onboarding field added successfully' as status; 