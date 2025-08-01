# Supabase Realtime Broadcast Setup

See dokument selgitab, kuidas seadistada ja kasutada Supabase Broadcast süsteemi efektiivse reaalajas pollimise jaoks.

## 🚀 Kiir Seadistamine

### 1. SQL Skripti Käivitamine

Käivita SQL skript Supabase SQL editoris:

```sql
-- Kopeeri ja käivita scripts/setup-realtime-broadcast.sql sisu
-- Supabase SQL editoris
```

Või kasuta käsurea skripti:

```bash
node scripts/apply-realtime-broadcast.js
```

### 2. Testimine

Testi broadcast süsteemi:

```bash
node scripts/test-broadcast-system.js
```

## 📋 Seadistuse Kontrollimine

### 1. Valideeri Seadistus

```sql
SELECT * FROM public.validate_broadcast_setup();
```

### 2. Kontrolli Süsteemi Tervist

```sql
SELECT * FROM public.get_broadcast_health();
```

### 3. Vaata Jõudluse Statistikat

```sql
SELECT * FROM public.get_broadcast_performance_stats();
```

## 🔧 Kliendi Koodi Uuendamine

### PlansStore on Juba Uuendatud

PlansStore on juba uuendatud, et kasutada Broadcast süsteemi Postgres Changes asemel:

```typescript
// Uus Broadcast lähenemine
await supabase.realtime.setAuth();

const channel = supabase
  .channel(`plans_broadcast_${userId}`, {
    config: { private: true }
  })
  .on('broadcast', { event: 'INSERT' }, (payload) => {
    handleBroadcastUpdate(payload, userId, 'INSERT');
  })
  .on('broadcast', { event: 'UPDATE' }, (payload) => {
    handleBroadcastUpdate(payload, userId, 'UPDATE');
  })
  .on('broadcast', { event: 'DELETE' }, (payload) => {
    handleBroadcastUpdate(payload, userId, 'DELETE');
  })
  .subscribe();
```

## 📊 Broadcast Kanalite Struktuur

Broadcast süsteem kasutab järgmisi kanaleid:

- `plan_poll_votes:{poll_id}` - Poll hääletuse muudatuste jaoks
- `plan_polls:{plan_id}` - Poll muudatuste jaoks
- `plan_poll_options:{plan_id}` - Poll valikute muudatuste jaoks
- `plan_updates:{plan_id}` - Plan uuenduste jaoks

## 🎯 Eelised Postgres Changes Üle

| Meetrik | Postgres Changes | Broadcast |
|---------|------------------|-----------|
| Skaleeruvus | Piiratud | Kõrge |
| Turvalisus | Põhineb RLS | Realtime Authorization |
| Jõudlus | Keskmine | Kõrge |
| Optimeerimine | Piiratud | Kõrge |

## 🧪 Testimine

### 1. Test Broadcast Süsteemi

```bash
node scripts/test-broadcast-system.js
```

### 2. Test Broadcast Funktsionaalsust

```sql
-- Testi broadcast süsteemi
SELECT public.test_broadcast_system('your-plan-id');
```

### 3. Vaata Broadcast Kanalid

```sql
-- Vaata plani broadcast kanaleid
SELECT * FROM public.get_plan_broadcast_topics('plan-id');
```

## 📈 Jõudluse Jälgimine

### Broadcast Statistika

```sql
-- Vaata broadcast statistikat
SELECT * FROM public.get_broadcast_stats('plan-id');
```

### Broadcast Aktiivsus

```sql
-- Vaata hiljutist broadcast aktiivsust
SELECT * FROM public.broadcast_activity;
```

## 🔍 Veateadete Lahendamine

### 1. "Broadcast channel error"

**Põhjus:** Realtime Authorization pole seadistatud
**Lahendus:** Veendu, et `supabase.realtime.setAuth()` on kutsutud

### 2. "No broadcast messages detected"

**Põhjus:** Broadcast süsteem pole aktiivne
**Lahendus:** Kontrolli, kas triggerid on loodud ja RLS poliitikad on seadistatud

### 3. "Permission denied"

**Põhjus:** Kasutajal pole õigusi broadcast kanalitele
**Lahendus:** Kontrolli RLS poliitikad ja veendu, et kasutaja on plani osaleja

## 📁 Failide Struktuur

```
scripts/
├── setup-realtime-broadcast.sql          # SQL seadistus
├── apply-realtime-broadcast.js           # Seadistuse skript
└── test-broadcast-system.js              # Test skript

docs/
└── REALTIME_BROADCAST_SETUP.md           # Detailne dokumentatsioon

store/
└── plansStore.ts                         # Uuendatud store broadcast jaoks
```

## 🎉 Järgmised Sammud

1. **Testi Broadcast Süsteemi** - Veendu, et kõik funktsionaalsused töötavad
2. **Jälgi Jõudlust** - Kasuta `get_broadcast_performance_stats()` funktsiooni
3. **Optimeeri Vajadusel** - Kohanda RLS poliitikaid vastavalt vajadustele
4. **Dokumenteeri** - Lisa dokumentatsiooni oma projekti jaoks

## 📞 Abi

Kui sul on küsimusi või probleeme:

1. Kontrolli dokumentatsiooni: `docs/REALTIME_BROADCAST_SETUP.md`
2. Käivita test skript: `node scripts/test-broadcast-system.js`
3. Kontrolli seadistust: `SELECT * FROM public.validate_broadcast_setup();`

## 🏆 Kokkuvõte

Supabase Broadcast süsteem pakub efektiivset ja skaleeruvat lahendust reaalajas pollimise jaoks. See on turvalisem ja jõudlikum kui Postgres Changes ning sobib hästi suuremahuliste rakenduste jaoks.

Broadcast süsteem automaatselt:
- Edastab poll hääletuse muudatused kõigile plani osalejatele
- Optimeerib võrgu kasutust
- Tagab turvalisuse Realtime Authorization kaudu
- Puhastab vanu sõnumeid automaatselt 