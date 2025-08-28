# Row Level Security (RLS) Setup Guide

## Ülevaade

See dokument kirjeldab Free to Hang rakenduse Row Level Security (RLS) süsteemi, mis tagab, et kasutajad näevad ainult neile lubatud andmeid.

## Põhiprintsiibid

### 1. **Friend Requests**
- Kasutaja näeb kõiki sõbrakutseid, kus ta on saatja (sender) või saaja (receiver)
- Kasutaja saab hallata oma sõbrakutseid

### 2. **Plans System**
Kui kasutaja on seotud plaaniga (creator või participant), näeb ta:

- ✅ **Kõiki plaani detaile** (title, description, date, location jne)
- ✅ **Kõiki osalejaid ja nende vastuseid** (accepted, maybe, declined jne)
- ✅ **Kõiki küsitlusi** (polls) ja nende valikuid
- ✅ **Kõiki hääli küsitlustel**
- ✅ **Kõiki plaani uuendusi** (notifications, updates)
- ✅ **Kõiki kohaloleku kirjeid**

### 3. **Users Table**
- Kasutaja näeb oma profiili
- Kasutaja näeb teiste inimeste profiile, kellega ta on ühendatud läbi plaanide või sõbrakutsete

### 4. **Service Role**
- Backend saab hallata kõiki andmeid ilma RLS piiranguteta

## RLS Reeglite Struktuur

### Tabelid, millel on RLS lubatud:
- `users`
- `plans`
- `plan_participants`
- `friend_requests`
- `plan_polls`
- `plan_poll_options`
- `plan_poll_votes`
- `plan_updates`
- `plan_attendance`

### Reeglite Tüübid:

1. **SELECT policies**: Määravad, milliseid ridu kasutaja näeb
2. **INSERT policies**: Määravad, milliseid ridu kasutaja saab lisada
3. **UPDATE policies**: Määravad, milliseid ridu kasutaja saab muuta
4. **DELETE policies**: Määravad, milliseid ridu kasutaja saab kustutada

## Rakendamine

### 1. Käivita RLS Setup Script

```sql
-- Ava Supabase SQL Editor ja käivita:
-- scripts/comprehensive-rls-setup.sql
```

### 2. Kontrolli, et RLS töötab

```sql
-- Kontrolli, et RLS on lubatud
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'plans', 'plan_participants', 'friend_requests');

-- Vaata RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

### 3. Testimine

Testi järgmised stsenaariumid:

#### Friend Requests
```sql
-- Kasutaja A loob sõbrakutse kasutajale B
INSERT INTO friend_requests (sender_id, receiver_id, status)
VALUES ('user-a-id', 'user-b-id', 'pending');

-- Kasutaja A peaks nägema oma sõbrakutse
SELECT * FROM friend_requests WHERE sender_id = 'user-a-id';
-- Kasutaja B peaks nägema saadud sõbrakutse
SELECT * FROM friend_requests WHERE receiver_id = 'user-b-id';
```

#### Plans System
```sql
-- Loo plaan
INSERT INTO plans (creator_id, title, date)
VALUES ('user-a-id', 'Test Plan', NOW() + INTERVAL '1 day');

-- Lisa osalejaid
INSERT INTO plan_participants (plan_id, user_id, status)
VALUES ('plan-id', 'user-b-id', 'accepted');

-- Kasutaja A (creator) peaks nägema kõiki plaani andmeid
SELECT * FROM plans WHERE id = 'plan-id';
SELECT * FROM plan_participants WHERE plan_id = 'plan-id';

-- Kasutaja B (participant) peaks nägema kõiki plaani andmeid
SELECT * FROM plans WHERE id = 'plan-id';
SELECT * FROM plan_participants WHERE plan_id = 'plan-id';

-- Kasutaja C (mitte-seotud) EI peaks nägema plaani andmeid
SELECT * FROM plans WHERE id = 'plan-id'; -- peaks olema tühi
```

## Tõrkeotsing

### 1. "insufficient_privilege" viga
- Veendu, et oled sisse logitud õige kasutajaga
- Kontrolli, et RLS reeglid on õigesti määratletud

### 2. Kasutaja ei näe andmeid, mida peaks nägema
- Kontrolli, et kasutaja on õigesti seotud plaaniga
- Vaata `plan_participants` tabelit
- Kontrolli RLS policies SQL tingimusi

### 3. RLS ei tööta üldse
- Veendu, et RLS on lubatud tabelitel
- Kontrolli, et policies on aktiivsed
- Vaata Supabase logisid

## Reeglite Detailid

### Plans Table
```sql
-- SELECT: Näeb plaane, kus on creator või participant
CREATE POLICY "Users can view their plans" ON plans
FOR SELECT USING (
  auth.uid() = creator_id OR
  auth.uid() IN (
    SELECT user_id FROM plan_participants WHERE plan_id = plans.id
  )
);
```

### Plan Participants Table
```sql
-- SELECT: Näeb kõiki osalejaid plaanides, kus ise osaleb
CREATE POLICY "Users can view plan participants" ON plan_participants
FOR SELECT USING (
  plan_id IN (
    SELECT id FROM plans WHERE
    creator_id = auth.uid() OR
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  )
);
```

### Friend Requests Table
```sql
-- SELECT: Näeb kõiki oma sõbrakutseid
CREATE POLICY "Users can view own friend requests" ON friend_requests
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

## Kokkuvõte

See RLS süsteem tagab, et:

1. **Privaatsus**: Kasutajad näevad ainult neile lubatud andmeid
2. **Täielik nähtavus plaanides**: Kui kasutaja on plaanis, näeb ta kõiki plaani andmeid
3. **Real-time ühilduvus**: Süsteem töötab koos Supabase real-time subscription'id-ga
4. **Turvalisus**: Tagab, et kasutajad ei näe teiste privaatplaane

See lähenemine on ideaalne sotsiaalsete rakenduste jaoks, kus kasutajad peavad nägema teiste inimeste tegevusi ühistes kontekstides (plaanides).
