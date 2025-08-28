-- FIX RLS FOR "everything-but-plans-working" PROJECT
-- This script fixes the critical RLS issues in the project

-- ====================================================================================
-- 1. KRITILINE PROBLEEM: plans tabelil ei ole SELECT policy't!
-- ====================================================================================

-- Luba RLS plans tabelil
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Kustuta vanad policies (kui eksisteerivad)
DROP POLICY IF EXISTS "Users can view plans" ON plans;
DROP POLICY IF EXISTS "Users can view their plans" ON plans;
DROP POLICY IF EXISTS "Users can view plans they're involved in" ON plans;

-- LISA PUUDUV SELECT POLICY plans tabelile
CREATE POLICY "Users can view their plans" ON plans
  FOR SELECT USING (
    auth.uid() = creator_id OR
    auth.uid() IN (
      SELECT user_id FROM plan_participants WHERE plan_id = plans.id
    )
  );

-- ====================================================================================
-- 2. PARANDA plan_participants SELECT policy
-- ====================================================================================

-- Kustuta vana kitsas policy
DROP POLICY IF EXISTS "Users can view plan participants" ON plan_participants;

-- Loo uus policy, mis lubab näha KÕIKI plaani osalejaid
CREATE POLICY "Users can view plan participants" ON plan_participants
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
    )
  );

-- ====================================================================================
-- 3. PARANDA plan_polls INSERT policy - lisa status kontroll
-- ====================================================================================

-- Kustuta vana policy
DROP POLICY IF EXISTS "Participants can create polls" ON plan_polls;

-- Loo uus policy koos status kontrolliga
CREATE POLICY "Plan participants can create polls" ON plan_polls
  FOR INSERT WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE
      creator_id = auth.uid() OR
      id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid() AND status = 'going')
    ) AND created_by = auth.uid()
  );

-- ====================================================================================
-- 4. PARANDA users tabeli RLS - lisa connected users policy
-- ====================================================================================

-- Kustuta vana policy
DROP POLICY IF EXISTS "Users can view public profiles for friend search" ON users;

-- Lisa policy, mis lubab näha ühendatud kasutajaid
CREATE POLICY "Users can view connected users" ON users
  FOR SELECT USING (
    auth.uid() IN (
      -- Users who are in the same plans
      SELECT DISTINCT pp.user_id
      FROM plan_participants pp
      WHERE pp.plan_id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      -- Plan creators of plans user is in
      SELECT DISTINCT p.creator_id
      FROM plans p
      WHERE p.id IN (
        SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
      )
      UNION
      -- Users who have friend requests with current user
      SELECT DISTINCT fr.sender_id FROM friend_requests fr WHERE fr.receiver_id = auth.uid()
      UNION
      SELECT DISTINCT fr.receiver_id FROM friend_requests fr WHERE fr.sender_id = auth.uid()
    )
  );

-- ====================================================================================
-- 5. KONTROLLI, et kõik policies on õigesti paigas
-- ====================================================================================

-- Kuva kõik policies kontrollimiseks
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('plans', 'plan_participants', 'plan_polls', 'users')
ORDER BY tablename, policyname;

-- ====================================================================================
-- 6. TESTI KRITILISI FUNKTSIOONE
-- ====================================================================================

/*
Testi järgmised stsenaariumid pärast skripti käivitamist:

1. Kasutaja näeb oma plaane:
SELECT id, title FROM plans WHERE auth.uid() = 'kasutaja-id';

2. Kasutaja näeb kõiki plaani osalejaid:
SELECT pp.user_id, pp.status, u.name
FROM plan_participants pp
JOIN users u ON pp.user_id = u.id
WHERE pp.plan_id = 'plani-id';

3. Kasutaja saab küsitlusi luua (kui status = 'going'):
-- See peaks töötama ainult 'going' staatusega osalejatele

4. Kasutaja näeb ühendatud kasutajaid:
SELECT id, name FROM users WHERE auth.uid() = 'kasutaja-id';
*/

-- ====================================================================================
-- SETUP COMPLETED!
-- ====================================================================================

-- Kontrolli RLS staatust
SELECT
  schemaname,
  tablename,
  rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'plans', 'plan_participants', 'friend_requests',
  'plan_polls', 'plan_poll_options', 'plan_poll_votes',
  'plan_updates', 'plan_attendance'
);
