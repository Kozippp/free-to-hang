-- ====================================================================================
-- FIX RLS FOR "everything-but-plans-working" PROJECT
-- Parandatud versioon - käivita see!
-- ====================================================================================

-- 1. KRITILINE: Luba RLS plans tabelil ja lisa SELECT policy
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view plans" ON plans;
DROP POLICY IF EXISTS "Users can view their plans" ON plans;
DROP POLICY IF EXISTS "Users can view plans they're involved in" ON plans;

CREATE POLICY "Users can view their plans" ON plans
  FOR SELECT USING (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT user_id FROM plan_participants WHERE plan_id = plans.id
    )
  );

-- 2. PARANDA plan_participants SELECT policy
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;

CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- 3. PARANDA plan_polls INSERT policy
DROP POLICY IF EXISTS "Participants can create polls" ON plan_polls;

CREATE POLICY "Plan participants can create polls" ON plan_polls
  FOR INSERT WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'going')
    ) AND created_by = auth.uid()
  );

-- 4. PARANDA users tabeli RLS
DROP POLICY IF EXISTS "Users can view public profiles for friend search" ON users;

CREATE POLICY "Users can view connected users" ON users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT DISTINCT pp.user_id
      FROM plan_participants pp
      WHERE pp.plan_id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      SELECT DISTINCT p.creator_id
      FROM plans p
      WHERE p.id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      SELECT DISTINCT fr.sender_id FROM friend_requests fr WHERE fr.receiver_id = auth.uid()
      UNION
      SELECT DISTINCT fr.receiver_id FROM friend_requests fr WHERE fr.sender_id = auth.uid()
    )
  );

-- ====================================================================================
-- KONTROLLI TULEMUST
-- ====================================================================================

-- Kuva kõik policies:
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  substring(qual::text, 1, 50) || '...' as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('plans', 'plan_participants', 'plan_polls', 'users')
ORDER BY tablename, policyname;

-- Lihtne kontroll:
SELECT
  'RLS Setup Complete!' as status,
  COUNT(*) as policies_created
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('plans', 'plan_participants', 'plan_polls', 'users');
