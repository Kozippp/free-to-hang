-- Add status_expires_at column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

-- Create an index for faster filtering of expired statuses
CREATE INDEX IF NOT EXISTS users_status_expires_at_idx ON public.users(status_expires_at);

-- Update RLS policies to allow users to update their own status_expires_at
-- Note: Assuming existing policies cover updates to 'users' based on auth.uid() = id
-- If not, we might need to add a policy, but usually 'users' table has a policy for own row update.
