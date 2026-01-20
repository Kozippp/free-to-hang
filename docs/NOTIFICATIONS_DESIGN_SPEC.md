# 🔔 Notifications System Design Specification

See dokument kirjeldab **Free to Hang** äpi teavituste paneeli disaini ja loogikat. Eesmärk on luua "Instagram-style" kogemus, mis on puhas, visuaalne ja vähendab müra (spam), grupeerides sarnased tegevused kokku.

---

## 1. Üldine Filosoofia

*   **Grupeerimine:** Me ei kuva kunagi iga chat-sõnumit või plaani uuendust eraldi reana. Kõik, mis kuulub samasse konteksti (sama chat room või sama plaan), koondatakse üheks kaardiks.
*   **Visuaalsus:** Ikoonide (kellukesed) asemel kasutame võimalusel **Inimeste Profiilipilte (Avatare)**. See muudab teavitused isiklikumaks ja arusaadavamaks.
*   **Action-Oriented:** Kutsed (sõbrad, plaanid) peavad olema koheselt lahendatavad nupuvajutusega, ilma et peaks vaadet vahetama.
*   **Keel:** Kogu UI tekst on **Inglise keeles**.

---

## 2. Kategooriad ja Loogika

Teavitused jagunevad nelja põhikategooriasse. Igal kategoorial on oma reeglid.

### A. Chat Groups (Vestlused)
Kui ühes vestluses on toimunud tegevus.

*   **Grupeerimise alus:** `plan_id` (või `room_id`).
*   **Visuaal (Avatarid):**
    *   Näitab viimaste rääkijate pilte (Stack).
    *   Maksimaalselt 2 pilti üksteise taga.
*   **Teksti Loogika (Rich Text):**
    *   1 saatja: "**Mihkel** sent a message in **Friday Sauna**"
    *   2 saatjat: "**Mihkel** and **Anna** sent messages in **Friday Sauna**"
    *   3+ saatjat: "**Mihkel**, **Anna** and 3 others sent messages in **Friday Sauna**"
*   **Klikkides:** Avab vastava chati vaate.

### B. Plan Activity (Plaani Uuendused)
Pollid, kellaaja muudatused, uued liitujad.

*   **Grupeerimise alus:** `plan_id`.
*   **Visuaal (Avatarid):**
    *   Näitab inimeste pilte, kes tegevust tegid (nt hääletasid või liitusid).
    *   Kui pilti pole võimalik laadida, kuvatakse Kalendri ikoon (kuid eesmärk on alati pilt).
*   **Teksti Loogika:**
    *   Pealkiri (Üleval): **Plaani Nimi** (Bold)
    *   Sisu (All): "5 new notifications (polls, joins)" või konkreetsemalt "**Mihkel** joined the plan".
*   **Klikkides:** Avab plaani detailvaate.

### C. Friend Requests (Sõbrakutsed)
Kutsed, mis vajavad kasutaja otsust. Need **EI** grupeeru, vaid on alati eraldi, et kasutaja saaks igale ühele reageerida.

*   **Visuaal:** Üks suur profiilipilt saatjast.
*   **Tekst:** "**Mihkel** sent you a friend request" (või "wants to connect").
*   **Nupud (Actions):**
    *   `[Confirm]` (Sinine) - Aktsepteerib koheselt.
    *   `[Delete]` (Hall) - Kustutab kutse (küsib kinnitust).
*   **Klikkides (Avataril/Nimele):** Avab kasutaja profiili modali (`UserProfileModal`).

### D. Plan Invites (Plaani Kutsed)
Isiklikud kutsed liituda plaaniga.

*   **Visuaal:** Kutsuja profiilipilt.
*   **Tekst:** "**Anna** invited you to join **Lunch @ F-Hoone**".
*   **Nupud (Actions):**
    *   `[Join]` (Sinine) - Märgib staatuse "Going".
    *   `[Decline]` (Hall) - Märgib staatuse "Declined" (küsib kinnitust).

---

## 3. UI Komponendid

### 3.1. NotificationAvatarStack
Komponent, mis vastutab piltide kuvamise eest.
*   Kui `actors.length === 1`: Üks suur ümmargune pilt.
*   Kui `actors.length > 1`: Kaks pilti nihkes (üks ees, teine taga).
*   Kui pilt puudub: Fallback initsiaalidele või geneerilisele avatarile.

### 3.2. NotificationGroupItem
Peamine rida (List Item).
*   **Layout:** Row (Vasakul pildid, keskel tekst, paremal nupud või täpp).
*   **Unread State:**
    *   Actionable item: Taustavärv võib olla õrnalt eristuv.
    *   Info item: Paremal servas väike sinine täpp (`unreadDot`).
*   **Aeg:** Teksti all halli kirjaga, lühiformaadis (nt "2h", "5m", "1d").

---

## 4. Tehniline Rakendus (Arendajale)

### Andmestruktuur (`NotificationGroup`)
Andmed töödeldakse failis `utils/notificationGrouper.ts`.

```typescript
interface NotificationGroup {
  id: string;           // Unikaalne ID (nt 'chat_plan_123')
  type: GroupType;      // 'chat_message' | 'plan_activity' | ...
  items: Notification[]; // Kõik toored teavitused selles grupis
  actors: User[];       // Inimesed, kelle pilti näidata (unikaalsed)
  title: string;        // Valmisgenereeritud rikas tekst
  isRead: boolean;      // Kas kõik grupi teavitused on loetud
  contextId: string;    // ID navigeerimiseks (planId, roomId)
}
```

### RLS (Row Level Security)
Et teavitused töötaksid korrektselt ja näitaksid nimesid/pilte, peab andmebaasis olema `users` tabelile ligipääs:
*   `CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);`

---

## 5. Tulevikuplaanid (Wishlist)
*   **Smart Categorization:** Eraldi tabid "Requests" ja "General", kui teavituste maht kasvab väga suureks.
*   **Reaction Previews:** Kui keegi reageerib sõnumile, näidata teavituses ka emoji ikooni.
