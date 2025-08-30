-- Create conditional dependencies table for plans
CREATE TABLE IF NOT EXISTS plan_conditional_dependencies (
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id, friend_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pcd_plan ON plan_conditional_dependencies(plan_id);
CREATE INDEX IF NOT EXISTS idx_pcd_plan_user ON plan_conditional_dependencies(plan_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pcd_plan_friend ON plan_conditional_dependencies(plan_id, friend_id);

-- Enable RLS
ALTER TABLE plan_conditional_dependencies ENABLE ROW LEVEL SECURITY;

-- Read access: users involved in the plan
DROP POLICY IF EXISTS "Users can view conditional deps for their plans" ON plan_conditional_dependencies;
CREATE POLICY "Users can view conditional deps for their plans" ON plan_conditional_dependencies FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE 
    creator_id = auth.uid() OR 
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);

-- Manage own rows
DROP POLICY IF EXISTS "Users can manage own conditional deps" ON plan_conditional_dependencies;
CREATE POLICY "Users can manage own conditional deps" ON plan_conditional_dependencies FOR ALL USING (
  user_id = auth.uid()
);

-- Service role full access
DROP POLICY IF EXISTS "Service role can manage all conditional deps" ON plan_conditional_dependencies;
CREATE POLICY "Service role can manage all conditional deps" ON plan_conditional_dependencies FOR ALL USING (
  auth.uid() IS NULL
);

