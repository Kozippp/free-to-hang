-- Fix friend_requests DELETE policy
-- Remove friend was not actually deleting rows - ensure RLS allows DELETE for both sender and receiver

-- Drop existing DELETE policy if present (may have been misconfigured or missing)
DROP POLICY IF EXISTS "Users can delete their friend requests" ON public.friend_requests;

-- Recreate DELETE policy - both sender and receiver can remove the friendship
CREATE POLICY "Users can delete their friend requests"
ON public.friend_requests
FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Ensure authenticated role has DELETE permission (belt and suspenders)
GRANT DELETE ON public.friend_requests TO authenticated;
