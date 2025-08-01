# Supabase Realtime Broadcast Setup for Polling System

See dokument selgitab, kuidas seadistada ja kasutada Supabase Broadcast süsteemi efektiivse reaalajas pollimise jaoks.

## Ülevaade

Supabase Broadcast on soovituslik meetod reaalajas andmete edastamiseks, kuna see on:
- **Skaleeruvam** kui Postgres Changes
- **Turvalisem** kuna kasutab Realtime Authorization
- **Efektiivsem** kuna ei pea kuulama kõiki andmebaasi muudatusi
- **Kiirem** kuna kasutab optimeeritud broadcast kanaleid

## Seadistamine

### 1. SQL Skripti Käivitamine

Käivita SQL skript, mis seadistab broadcast süsteemi:

```bash
# Käsurea skript
node scripts/apply-realtime-broadcast.js

# Või käsitsi Supabase SQL editoris
# Kopeeri ja käivita scripts/setup-realtime-broadcast.sql sisu
```

### 2. Broadcast Süsteemi Komponendid

Skript loob järgmised komponendid:

#### Trigger Funktsioonid
- `handle_poll_vote_changes()` - Poll hääletuse muudatuste jaoks
- `handle_poll_changes()` - Poll muudatuste jaoks
- `handle_poll_option_changes()` - Poll valikute muudatuste jaoks
- `handle_plan_update_changes()` - Plan uuenduste jaoks

#### RLS Poliitikad
- `Authenticated users can receive broadcasts` - Põhiline broadcast poliitika
- `Plan participants can receive poll vote broadcasts` - Poll hääletuse jaoks
- `Plan participants can receive poll broadcasts` - Poll muudatuste jaoks
- `Plan participants can receive poll option broadcasts` - Poll valikute jaoks
- `Plan participants can receive plan update broadcasts` - Plan uuenduste jaoks

#### Abifunktsioonid
- `get_plan_participants()` - Plan osalejate saamiseks
- `validate_broadcast_setup()` - Seadistuse kontrollimiseks
- `get_broadcast_health()` - Süsteemi tervise kontrollimiseks
- `get_broadcast_performance_stats()` - Jõudluse jälgimiseks

## Kliendi Koodi Uuendamine

### 1. PlansStore Uuendamine

PlansStore on juba uuendatud, et kasutada Broadcast süsteemi:

```typescript
// Vanem Postgres Changes lähenemine (eemaldatud)
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'plan_poll_votes'
}, (payload) => {
  handlePollVoteUpdate(payload, userId);
})

// Uus Broadcast lähenemine
.on('broadcast', { event: 'INSERT' }, (payload) => {
  handleBroadcastUpdate(payload, userId, 'INSERT');
})
.on('broadcast', { event: 'UPDATE' }, (payload) => {
  handleBroadcastUpdate(payload, userId, 'UPDATE');
})
.on('broadcast', { event: 'DELETE' }, (payload) => {
  handleBroadcastUpdate(payload, userId, 'DELETE');
})
```

### 2. Realtime Authorization Seadistamine

```typescript
// Seadista autentimine broadcast jaoks
await supabase.realtime.setAuth();

// Loo privaatne kanal
const channel = supabase
  .channel(`plans_broadcast_${userId}`, {
    config: { private: true } // Vajalik Realtime Authorization jaoks
  })
```

### 3. Broadcast Update Handler

```typescript
function handleBroadcastUpdate(payload: any, currentUserId: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE') {
  // Handle different types of broadcast updates based on table
  switch (payload.table) {
    case 'poll_votes':
      console.log('🗳️ Poll vote broadcast received');
      loadPlans(currentUserId);
      break;
      
    case 'plan_polls':
      console.log('📊 Poll broadcast received');
      loadPlans(currentUserId);
      break;
      
    case 'poll_options':
      console.log('📋 Poll option broadcast received');
      loadPlans(currentUserId);
      break;
      
    case 'plan_updates':
      console.log('📢 Plan update broadcast received');
      loadPlans(currentUserId);
      break;
      
    default:
      console.log('❓ Unknown broadcast table:', payload.table);
      loadPlans(currentUserId);
      break;
  }
}
```

## Broadcast Kanalite Struktuur

Broadcast süsteem kasutab järgmisi kanaleid:

### Poll Hääletuse Kanalid
- `plan_poll_votes:{poll_id}` - Konkreetse polli hääletuse muudatuste jaoks

### Poll Kanalid
- `plan_polls:{plan_id}` - Plani pollide muudatuste jaoks

### Poll Valikute Kanalid
- `plan_poll_options:{plan_id}` - Plani poll valikute muudatuste jaoks

### Plan Uuenduste Kanalid
- `plan_updates:{plan_id}` - Plani uuenduste jaoks

## Jõudluse Optimeerimine

### 1. Üks Kanal Kõigile Sündmustele

Broadcast süsteem kasutab ainult ühte kanalit kõigile sündmustele, mis on efektiivsem kui mitme kanali kasutamine.

### 2. Optimeeritud RLS Poliitikad

RLS poliitikad tagavad, et kasutajad saavad ainult neid broadcast sõnumeid, millele neil on õigus.

### 3. Automaatne Puhastamine

Supabase automaatselt puhastab broadcast sõnumeid 3 päeva pärast.

## Testimine

### 1. Seadistuse Kontrollimine

```sql
-- Kontrolli, kas kõik komponendid on seadistatud
SELECT * FROM public.validate_broadcast_setup();
```

### 2. Süsteemi Tervise Kontrollimine

```sql
-- Kontrolli süsteemi tervist
SELECT * FROM public.get_broadcast_health();
```

### 3. Jõudluse Jälgimine

```sql
-- Vaata jõudluse statistikat
SELECT * FROM public.get_broadcast_performance_stats();
```

### 4. Test Broadcast

```sql
-- Testi broadcast süsteemi
SELECT public.test_broadcast_system('your-plan-id');
```

## Veateadete Lahendamine

### 1. "Broadcast channel error"

**Põhjus:** Realtime Authorization pole seadistatud
**Lahendus:** Veendu, et `supabase.realtime.setAuth()` on kutsutud

### 2. "No broadcast messages detected"

**Põhjus:** Broadcast süsteem pole aktiivne
**Lahendus:** Kontrolli, kas triggerid on loodud ja RLS poliitikad on seadistatud

### 3. "Permission denied"

**Põhjus:** Kasutajal pole õigusi broadcast kanalitele
**Lahendus:** Kontrolli RLS poliitikad ja veendu, et kasutaja on plani osaleja

## Jõudluse Võrdlus

### Postgres Changes vs Broadcast

| Meetrik | Postgres Changes | Broadcast |
|---------|------------------|-----------|
| Skaleeruvus | Piiratud | Kõrge |
| Turvalisus | Põhineb RLS | Realtime Authorization |
| Jõudlus | Keskmine | Kõrge |
| Seadistamine | Lihtne | Keskmine |
| Optimeerimine | Piiratud | Kõrge |

## Järgmised Sammud

1. **Testi Broadcast Süsteemi** - Veendu, et kõik funktsionaalsused töötavad
2. **Jälgi Jõudlust** - Kasuta `get_broadcast_performance_stats()` funktsiooni
3. **Optimeeri Vajadusel** - Kohanda RLS poliitikaid vastavalt vajadustele
4. **Dokumenteeri** - Lisa dokumentatsiooni oma projekti jaoks

## Kasulikud Funktsioonid

### Seadistuse Kontrollimine
```sql
SELECT * FROM public.validate_broadcast_setup();
```

### Süsteemi Tervis
```sql
SELECT * FROM public.get_broadcast_health();
```

### Jõudluse Statistika
```sql
SELECT * FROM public.get_broadcast_performance_stats();
```

### Broadcast Kanalid
```sql
SELECT * FROM public.get_plan_broadcast_topics('plan-id');
```

### Test Broadcast
```sql
SELECT public.test_broadcast_system('plan-id');
```

### Broadcast Statistika
```sql
SELECT * FROM public.get_broadcast_stats('plan-id');
```

## Kokkuvõte

Supabase Broadcast süsteem pakub efektiivset ja skaleeruvat lahendust reaalajas pollimise jaoks. See on turvalisem ja jõudlikum kui Postgres Changes ning sobib hästi suuremahuliste rakenduste jaoks.

Broadcast süsteem automaatselt:
- Edastab poll hääletuse muudatused kõigile plani osalejatele
- Optimeerib võrgu kasutust
- Tagab turvalisuse Realtime Authorization kaudu
- Puhastab vanu sõnumeid automaatselt 