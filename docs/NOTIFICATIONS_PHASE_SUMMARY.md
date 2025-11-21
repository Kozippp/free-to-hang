## Notification System MVP Deliverable (Faasid 1–3)

### Mis valmis sai
- **Andmebaas:** lisatud `notifications`, `push_tokens`, `notification_preferences` tabelid, RLS-id, trigger uute kasutajate eelistustele ning `user_status.last_active` + indeksid (fail `supabase/schema.sql`).
- **Backend teenused:** uus `notificationService` (Expo push + eelistused + quiet hours) ja `engagementService` (chain effect + comeback cron). Notification routes `/api/notifications/*` lisatud.
- **Integreerimine:** plans/chat/friends/user route’ides käivitatakse teavitused plaani kutsete, liitujate, chati sõnumite, polli sündmuste, sõbrataotluste ja “friend online” statuse jaoks.
- **Frontend:** loodud `notificationsStore`, push utiliit (`utils/pushNotifications.ts`), uued tab + ekraan `app/(tabs)/notifications.tsx`, märguande badge `_layout`is ning `hangStore` uuendab staatust backend PATCHi kaudu.

### Katmata/kontrolli vajab
1. **SQL deploy:** käivita uuendatud `supabase/schema.sql` Supabase SQL Editoris enne build’e.
2. **Expo projectId:** asenda `app.json` → `extra.eas.projectId` päris väärtusega; ilma selleta push-token ei registreeru.
3. **Füüsiline test:** build/Expo Go seadmel – kontrolli kõik sündmused ja push märguanded juhendis loetletud checklisti järgi.
4. **Notification eelistuste UI:** backend toetab, kuid eraldi seadistusvaadet veel pole.
5. **Scheduler monitoring:** Railway logidest kontrolli, et `startEngagementScheduler()` töötab ning cron ajastab 18:00 UTC.

### Järgmised soovitused Sonnet 4.5-le
- Valideeri funktsionaalne voog (kõik 8 sündmust + chain effect) otse seadmel.
- Kui midagi ebaõnnestub, loo detailne bugiraport koos Supabase logidega.
- Soovita, kas järgmiseks teha re-engagement UI, teavituste eelistusvaade või badge/reset optimeerimine.

