# Poll Votes Realtime Fix

## Probleem

Poll voting kasutab nüüd direct DB writes (nagu chat), aga DELETE eventid ei sisalda täielikku objekti - ainult `id`.

**Sümptomid:**
- Vote eemaldamine (unvote) ei tööta alati
- Konsoolis: `⚠️ Invalid poll vote payload`
- DELETE eventis: `old: { id: "..." }` (puudub `poll_id`, `option_id`, `user_id`)

## Lahendus

Luba `REPLICA IDENTITY FULL` tabelile `plan_poll_votes`.

### Sammud

1. **Ava Supabase Dashboard**
   - Mine: https://supabase.com/dashboard
   - Vali oma projekt

2. **Ava SQL Editor**
   - Vasakult menüüst: SQL Editor
   - Või otse: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

3. **Käivita SQL**
   ```sql
   ALTER TABLE plan_poll_votes REPLICA IDENTITY FULL;
   ```

4. **Kontrolli tulemust**
   ```sql
   SELECT relname, relreplident 
   FROM pg_class 
   WHERE relname = 'plan_poll_votes';
   ```
   
   Peaks näitama: `relreplident = 'f'` (full)

### Miks see aitab?

- **REPLICA IDENTITY DEFAULT** (vaikimisi): DELETE eventid sisaldavad ainult primary key (`id`)
- **REPLICA IDENTITY FULL**: DELETE eventid sisaldavad KÕIKI veerge (`id`, `poll_id`, `option_id`, `user_id`, `created_at`)

Nüüd realtime listener saab DELETE eventist kätte `poll_id`, `option_id` ja `user_id` ning oskab õiget vote'i eemaldada!

### Testimine

Pärast SQL käivitamist:

1. Restart app (reload)
2. Vote pollil
3. Unvote (eemalda vote)
4. Konsoolis peaks nägema:
   ```
   🗳️ Processing poll vote DELETE: {
     oldVote: {
       id: "...",
       poll_id: "...",      ← Nüüd olemas!
       option_id: "...",    ← Nüüd olemas!
       user_id: "..."       ← Nüüd olemas!
     }
   }
   ```

### Performance

**Kas see mõjutab performance'i?**
- Minimaalselt - DELETE eventid on suuremad (sisaldavad rohkem data)
- Aga poll votes on väikesed objektid (4-5 välja)
- Kasutusjuhtum: mõni vote minutis per user
- **Trade-off väärt** - realtime töötab korralikult!

## Alternatiivid (kui FULL ei sobi)

Kui mingil põhjusel ei saa FULL kasutada:

1. **Client-side cache**: Hoia meeles kõik votes enne DELETE'i
2. **Refetch poll**: DELETE korral lae poll uuesti API-st
3. **Composite key**: Kasuta `(poll_id, user_id)` kui REPLICA IDENTITY INDEX

Aga **FULL on lihtsaim ja töökindlaim** selle use case jaoks!
