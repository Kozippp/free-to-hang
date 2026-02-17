# Otseühenduse Migratsiooniplaan (Direct Supabase Read & Realtime)

**Olek:** 🟡 Ootel (Pending)
**Viimati uuendatud:** 17.02.2026
**Eesmärk:** Muuta rakendus kiiremaks ja töökindlamaks, viies andmete lugemise (GET) ja reaalaja uuendused otse Supabase'i kliendi peale, eemaldades Node.js serveri vahelülist nendes protsessides.

---

## 🤖 Juhised Agendile / Arendajale

1.  **Loe ja saa aru:** Enne koodi muutmist loe see dokument läbi.
2.  **Täida järjest:** Võta ette üks sektsioon korraga (nt "Faas 1: RLS").
3.  **Uuenda seda dokumenti:**
    *   Kui ülesanne on tehtud, märgi kasti sisse `[x]`.
    *   Lisa sektsiooni "Logi / Märkmed" lühike sissekanne tehtud muudatustest.
4.  **Säilita funktsionaalsus:** Chati loogikat **MITTE PUUTUDA**. See töötab hästi. Keskendu ainult "Plans" ja "Friends" moodulitele.
5.  **Hübriid-mudel:** Jäta keerulised kirjutamised (POST/PUT, nt `createPlan`, `sendNotification`) endiselt käima läbi Node.js API. Me muudame ainult andmete *lugemist* ja *kuulamist*.

---

## Faas 1: Turvalisus ja RLS (Row Level Security) ettevalmistus

Kuna klient hakkab andmeid otse lugema, peame olema 100% kindlad, et andmebaasi reeglid (Policies) lubavad kasutajal näha ainult talle mõeldud andmeid.

- [ ] **1.1. Kontrolli `plans` tabeli RLS-i.**
    *   *Reegel:* Kasutaja tohib näha plaani (SELECT), kui ta on:
        *   Plaani looja (`creator_id = auth.uid()`)
        *   VÕI osalejate nimekirjas (`id IN (select plan_id from plan_participants where user_id = auth.uid())`)
        *   VÕI plaan on avalik (kui selline kontseptsioon eksisteerib).
    *   *Tegevus:* Loo või uuenda Supabase SQL policy.

- [ ] **1.2. Kontrolli `plan_participants` tabeli RLS-i.**
    *   *Reegel:* Kasutaja tohib näha osalejaid plaanides, kus ta ise osaleb või on looja.

- [ ] **1.3. Kontrolli `friend_requests` ja `users` tabeli RLS-i.**
    *   *Reegel:* `users` andmed peaksid olema avalikult loetavad (vähemalt nimi, avatar), et otsing töötaks.
    *   *Reegel:* `friend_requests` tohib näha ainult osapool (`sender_id` või `receiver_id`).

---

## Faas 2: Sõprade nimekirja optimeerimine (Lihtsam ülesanne)

Eesmärk: Asendada `GET /api/friends` otsese päringuga.

- [ ] **2.1. Loo uus funktsioon `lib/friends-service.ts` failis (või sarnases).**
    *   Funktsiooni nimi: `fetchFriendsDirect()`.
    *   Loogika:
        ```typescript
        // Näidis pseudokood
        const { data } = await supabase
          .from('friend_requests')
          .select(`
            id,
            status,
            sender:sender_id(id, name, avatar_url, username),
            receiver:receiver_id(id, name, avatar_url, username)
          `)
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .eq('status', 'accepted');
        // Siin tuleb andmed mapida nii, et tagastatakse alati "teise poole" profiil.
        ```

- [ ] **2.2. Ühenda React komponendiga.**
    *   Leia koht, kus laetakse sõpru (nt `FriendsList.tsx` või `InviteFriendsModal.tsx`).
    *   Asenda vana API kutse uue `fetchFriendsDirect` funktsiooniga.

---

## Faas 3: Plaanide nimekirja optimeerimine (Peamine võit)

Eesmärk: Asendada `GET /api/plans` otsese päringuga. See teeb "Home" vaate ja "My Plans" vaate kiireks.

- [ ] **3.1. Uuenda `Plan` tüüpi (vajadusel).**
    *   Veendu, et TypeScripti tüübid vastaksid Supabase'i vastusele (JOINitud tabelid on sageli objektid või massiivid).

- [ ] **3.2. Implementeeri andmete lugemine `lib/plans-service.ts`.**
    *   Funktsioon: `fetchPlansDirect(userId)`.
    *   Päring peab laadima korraga:
        *   Plaanid (`plans`)
        *   Osalejad (`plan_participants` + `users` info)
        *   Küsitlused (`plan_polls` + `plan_poll_options` + `plan_poll_votes`) - *NB: Vaata, kas on mõistlik laadida kõik korraga või jätta detailvaate jaoks.*
    *   *Soovitus:* Esialgu lae nimekirja jaoks ainult `plans` + `participants`. Detailvaate avamisel lae täisinfo (polls jne).

- [ ] **3.3. Asenda `usePlansStore` laadimisloogika.**
    *   Failis `store/plansStore.ts` asenda `loadPlans` meetodis olev API kutse uue Supabase päringuga.

---

## Faas 4: Üksiku plaani detailvaade (Detail View)

Eesmärk: Kui kasutaja avab plaani, laetakse andmed otse, mitte läbi `GET /api/plans/:id`.

- [ ] **4.1. Implementeeri `fetchPlanDetailsDirect(planId)`.**
    *   See päring peab olema sügav:
        ```typescript
        .select(`
          *,
          creator:users!creator_id(*),
          participants:plan_participants(*, user:users(*)),
          polls:plan_polls(*, 
            options:plan_poll_options(*, 
              votes:plan_poll_votes(*)
            )
          )
        `)
        ```
    *   *Märkus:* Veendu, et andmestruktuur klapiks täpselt sellega, mida `PlanDetailView` ootab.

- [ ] **4.2. Uuenda `PlanDetailView` või Store.**
    *   Kasuta detailvaate avamisel uut funktsiooni.

---

## Faas 5: Reaalaja (Realtime) uuendused

Eesmärk: Asendada praegune serveri-poolne socketi loogika (või polling) Supabase Realtime tellimustega.

- [ ] **5.1. Seadista globaalne kuulaja `plansStore.ts` failis.**
    *   Tellimus tabelile `plans`:
        *   `INSERT`: Kui lisandub plaan, kus ma olen osaleja -> lisa store'i.
        *   `UPDATE`: Kui plaani andmed muutuvad -> uuenda store'i.
    *   Tellimus tabelile `plan_participants`:
        *   `INSERT`: Keegi liitus plaaniga -> uuenda osalejate nimekirja.
        *   `UPDATE`: Keegi muutis staatust (nt "Going") -> uuenda store'i.

- [ ] **5.2. Eemalda vana värskendusloogika.**
    *   Kui koodis on `setInterval` või muu polling, eemalda see.

---

## Faas 6: Testimine ja Puhastus

- [ ] **6.1. Testi uue kasutajaga.**
    *   Veendu, et uus kasutaja näeb ainult oma plaane (RLS test).
- [ ] **6.2. Testi võrguühenduseta (osaliselt).**
    *   Kas äpp krahhib või näitab viga viisakalt?
- [ ] **6.3. Eemalda kasutamata kood.**
    *   Kommenteeri välja või kustuta vana API loogika failides, et vältida segadust.

---

## 📝 Logi / Märkmed Agendilt

*   *(Siia kirjutab agent tehtud töödest)*
*   [Kuupäev] - Loodud esialgne plaan.
