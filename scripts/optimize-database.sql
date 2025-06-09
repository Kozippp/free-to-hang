-- CRITICAL DATABASE OPTIMIZATIONS FOR PRODUCTION
-- Run this to fix performance issues

-- 1. ADD MISSING INDEXES FOR CRITICAL QUERIES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'available';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plan_participants_user ON plan_participants(user_id, response);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plan_participants_plan ON plan_participants(plan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plans_creator ON plans(creator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- 2. OPTIMIZE FRIEND LOADING QUERY WITH MATERIALIZED VIEW
CREATE MATERIALIZED VIEW IF NOT EXISTS user_friend_status AS
SELECT 
  f.user_id,
  f.friend_id,
  u.name as friend_name,
  u.username as friend_username,
  u.avatar_url as friend_avatar,
  u.status as friend_status,
  u.vibe as friend_vibe,
  u.updated_at as friend_last_updated
FROM friendships f
JOIN users u ON f.friend_id = u.id
WHERE u.status IS NOT NULL;

-- Index the materialized view
CREATE INDEX IF NOT EXISTS idx_user_friend_status_user ON user_friend_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friend_status_friend ON user_friend_status(friend_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_friend_status()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_friend_status;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-refresh when data changes
DROP TRIGGER IF EXISTS refresh_friends_on_user_update ON users;
CREATE TRIGGER refresh_friends_on_user_update
  AFTER UPDATE OF status, name, username, avatar_url ON users
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_friend_status();

DROP TRIGGER IF EXISTS refresh_friends_on_friendship_change ON friendships;
CREATE TRIGGER refresh_friends_on_friendship_change
  AFTER INSERT OR DELETE ON friendships
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_friend_status();

-- 3. OPTIMIZE PLAN LOADING WITH BETTER QUERY STRUCTURE
CREATE OR REPLACE VIEW user_plans_view AS
SELECT 
  p.id as plan_id,
  p.title,
  p.description,
  p.location,
  p.date,
  p.type,
  p.creator_id,
  p.created_at,
  p.updated_at,
  creator.name as creator_name,
  creator.avatar_url as creator_avatar,
  pp.user_id as participant_id,
  pp.response as participant_response,
  participant.name as participant_name,
  participant.avatar_url as participant_avatar
FROM plans p
LEFT JOIN users creator ON p.creator_id = creator.id
JOIN plan_participants pp ON p.id = pp.plan_id
LEFT JOIN users participant ON pp.user_id = participant.id;

-- 4. ADD PARTIAL INDEXES FOR BETTER PERFORMANCE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plans_active ON plans(id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friend_requests_pending ON friend_requests(receiver_id) WHERE status = 'pending';

-- 5. OPTIMIZE SEARCH FUNCTIONALITY
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search_gin ON users USING gin((name || ' ' || username || ' ' || COALESCE(email, '')) gin_trgm_ops);

-- 6. ADD FUNCTION FOR EFFICIENT FRIEND SEARCH
CREATE OR REPLACE FUNCTION search_users_optimized(
  search_query TEXT,
  current_user_id UUID,
  search_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  username TEXT,
  avatar_url TEXT,
  vibe TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.username,
    u.avatar_url,
    u.vibe
  FROM users u
  WHERE 
    u.id != current_user_id
    AND (
      u.username ILIKE '%' || search_query || '%' OR
      u.name ILIKE '%' || search_query || '%' OR
      u.email ILIKE '%' || search_query || '%'
    )
    AND u.id NOT IN (
      SELECT friend_id FROM friendships WHERE user_id = current_user_id
      UNION
      SELECT sender_id FROM friend_requests WHERE receiver_id = current_user_id
      UNION  
      SELECT receiver_id FROM friend_requests WHERE sender_id = current_user_id
      UNION
      SELECT blocked_id FROM blocked_users WHERE blocker_id = current_user_id
    )
  ORDER BY 
    CASE 
      WHEN u.username ILIKE search_query || '%' THEN 1
      WHEN u.name ILIKE search_query || '%' THEN 2
      ELSE 3
    END,
    u.name
  LIMIT search_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. OPTIMIZE STATUS UPDATES WITH DEBOUNCING
CREATE OR REPLACE FUNCTION update_user_status_optimized(
  user_id UUID,
  new_status TEXT,
  new_activity TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status TEXT;
  status_changed BOOLEAN DEFAULT FALSE;
BEGIN
  -- Get current status
  SELECT status INTO current_status FROM users WHERE id = user_id;
  
  -- Only update if status actually changed
  IF current_status != new_status THEN
    UPDATE users 
    SET 
      status = new_status,
      updated_at = NOW()
    WHERE id = user_id;
    status_changed = TRUE;
  END IF;
  
  RETURN status_changed;
END;
$$ LANGUAGE plpgsql;

-- 8. ADD CLEANUP FUNCTION FOR OLD DATA
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $$
BEGIN
  -- Clean up old friend requests (older than 30 days)
  DELETE FROM friend_requests 
  WHERE created_at < NOW() - INTERVAL '30 days' 
  AND status = 'pending';
  
  -- Clean up completed plans older than 3 months
  DELETE FROM plans 
  WHERE status = 'completed' 
  AND created_at < NOW() - INTERVAL '3 months';
  
  -- Log cleanup
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- 9. REFRESH THE MATERIALIZED VIEW INITIALLY
REFRESH MATERIALIZED VIEW user_friend_status;

COMMIT; 